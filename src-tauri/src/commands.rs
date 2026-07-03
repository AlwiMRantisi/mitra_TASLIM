use crate::auth::{hash_password, verify_password};
use crate::db::DbState;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{Manager, State};

#[tauri::command]
pub fn save_arxiva_file(
    subfolder: String,
    filename: String,
    data: Vec<u8>,
    app_handle: tauri::AppHandle,
) -> Result<String, String> {
    let download_dir = app_handle
        .path()
        .download_dir()
        .map_err(|e| format!("Gagal mendapatkan folder download: {}", e))?;

    let target_dir = download_dir.join("arxiva").join(subfolder);
    std::fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Gagal membuat folder arxiva: {}", e))?;

    let file_path = target_dir.join(filename);
    std::fs::write(&file_path, data)
        .map_err(|e| format!("Gagal menyimpan file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn save_export_file(path: String, contents: String) -> Result<(), String> {
    let export_path = PathBuf::from(path);

    if let Some(parent) = export_path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    std::fs::write(export_path, contents.as_bytes()).map_err(|error| error.to_string())
}

#[derive(Serialize, Deserialize)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "totalItems")]
    pub total_items: i32,
    #[serde(rename = "safetyStock")]
    pub safety_stock: i32,
}

#[derive(Serialize, Deserialize)]
pub struct Brand {
    pub id: String,
    pub name: String,
    pub identifier: String,
    pub origin: String,
    #[serde(rename = "totalItems")]
    pub total_items: i32,
}

#[derive(Serialize, Deserialize)]
pub struct Partner {
    pub id: String,
    pub code: String,
    pub name: String,
    #[serde(rename = "partnerType")]
    pub partner_type: String,
    #[serde(rename = "contactPerson")]
    pub contact_person: String,
    pub phone: String,
    pub email: String,
    pub address: String,
    #[serde(rename = "isActive")]
    pub is_active: bool,
    #[serde(default)]
    pub username: Option<String>,
}

#[derive(Serialize)]
pub struct AuthUser {
    pub id: String,
    pub username: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub role: String,
    #[serde(rename = "partnerId")]
    pub partner_id: Option<String>,
    #[serde(rename = "identityCode")]
    pub identity_code: String,
}

#[derive(Serialize)]
pub struct OwnerIdentitySettings {
    #[serde(rename = "kpCode")]
    pub kp_code: String,
}

fn normalize_identity_code(code: &str) -> Result<String, String> {
    let normalized = code.trim().to_uppercase();

    if normalized.len() < 2 || normalized.len() > 30 {
        return Err("Kode identitas harus terdiri dari 2 sampai 30 karakter.".to_string());
    }
    if !normalized
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
    {
        return Err(
            "Kode identitas hanya boleh berisi huruf, angka, tanda hubung, atau underscore."
                .to_string(),
        );
    }

    Ok(normalized)
}

#[tauri::command]
pub fn login(
    state: State<DbState>,
    username: String,
    password: String,
) -> Result<AuthUser, String> {
    let conn = state.0.lock().unwrap();
    let normalized_username = username.trim();

    let user = conn
        .query_row(
            "SELECT u.id, u.username, u.password_hash, u.role, u.display_name,
                    u.partner_id, u.is_active,
                    CASE
                        WHEN u.role = 'admin' THEN (
                            SELECT value FROM app_settings
                            WHERE key = 'kp_identity_code'
                        )
                        ELSE p.code
                    END
             FROM users u
             LEFT JOIN partners p ON p.id = u.partner_id
             WHERE u.username = ?1 COLLATE NOCASE",
            params![normalized_username],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, Option<String>>(5)?,
                    row.get::<_, i32>(6)? != 0,
                    row.get::<_, String>(7)?,
                ))
            },
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let Some((
        id,
        username,
        password_hash,
        role,
        display_name,
        partner_id,
        is_active,
        identity_code,
    )) = user
    else {
        return Err("Username atau password salah.".to_string());
    };

    if !is_active {
        return Err("Akun ini sedang dinonaktifkan.".to_string());
    }

    if !verify_password(&password, &password_hash) {
        return Err("Username atau password salah.".to_string());
    }

    Ok(AuthUser {
        id,
        username,
        display_name,
        role,
        partner_id,
        identity_code,
    })
}

#[tauri::command]
pub fn get_owner_identity_settings(state: State<DbState>) -> Result<OwnerIdentitySettings, String> {
    let conn = state.0.lock().unwrap();
    let kp_code = conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'kp_identity_code'",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    Ok(OwnerIdentitySettings { kp_code })
}

#[tauri::command]
pub fn update_kp_identity_code(state: State<DbState>, code: String) -> Result<(), String> {
    let normalized_code = normalize_identity_code(&code)?;
    let conn = state.0.lock().unwrap();

    conn.execute(
        "INSERT INTO app_settings (key, value)
         VALUES ('kp_identity_code', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![normalized_code],
    )
    .map_err(|error| error.to_string())?;

    Ok(())
}

// Category Commands
#[tauri::command]
pub fn get_categories(state: State<DbState>) -> Result<Vec<Category>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, description, total_items, safety_stock FROM categories")
        .map_err(|e| e.to_string())?;

    let categories_iter = stmt
        .query_map([], |row| {
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                total_items: row.get(3)?,
                safety_stock: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut categories = Vec::new();
    for category in categories_iter {
        categories.push(category.map_err(|e| e.to_string())?);
    }

    Ok(categories)
}

#[tauri::command]
pub fn add_category(state: State<DbState>, category: Category) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let normalized_name = category.name.trim();

    if normalized_name.is_empty() {
        return Err("Nama kategori wajib diisi.".to_string());
    }
    if category.safety_stock < 0 {
        return Err("Safety stock tidak boleh bernilai negatif.".to_string());
    }

    let duplicate_exists: bool = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM categories
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(?1))
            )",
            params![normalized_name],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if duplicate_exists {
        return Err("Nama kategori sudah terdaftar.".to_string());
    }

    conn.execute(
        "INSERT INTO categories (id, name, description, total_items, safety_stock) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            category.id,
            normalized_name,
            category.description,
            category.total_items,
            category.safety_stock
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_category(state: State<DbState>, category: Category) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let normalized_name = category.name.trim();

    if normalized_name.is_empty() {
        return Err("Nama kategori wajib diisi.".to_string());
    }
    if category.safety_stock < 0 {
        return Err("Safety stock tidak boleh bernilai negatif.".to_string());
    }

    let duplicate_exists: bool = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM categories
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(?1))
                  AND id <> ?2
            )",
            params![normalized_name, &category.id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if duplicate_exists {
        return Err("Nama kategori sudah terdaftar.".to_string());
    }

    conn.execute(
        "UPDATE categories SET name = ?1, description = ?2, total_items = ?3, safety_stock = ?4 WHERE id = ?5",
        params![
            normalized_name,
            category.description,
            category.total_items,
            category.safety_stock,
            category.id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_category(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM categories WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Brand Commands
#[tauri::command]
pub fn get_brands(state: State<DbState>) -> Result<Vec<Brand>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, identifier, origin, total_items FROM brands")
        .map_err(|e| e.to_string())?;

    let brands_iter = stmt
        .query_map([], |row| {
            Ok(Brand {
                id: row.get(0)?,
                name: row.get(1)?,
                identifier: row.get(2)?,
                origin: row.get(3)?,
                total_items: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut brands = Vec::new();
    for brand in brands_iter {
        brands.push(brand.map_err(|e| e.to_string())?);
    }

    Ok(brands)
}

#[tauri::command]
pub fn add_brand(state: State<DbState>, brand: Brand) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let normalized_name = brand.name.trim();
    let normalized_identifier = brand.identifier.trim().to_uppercase();

    if normalized_name.is_empty() {
        return Err("Nama merek wajib diisi.".to_string());
    }
    if normalized_identifier.is_empty() {
        return Err("Identifier merek wajib diisi.".to_string());
    }

    let duplicate_name: bool = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM brands
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(?1))
            )",
            params![normalized_name],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if duplicate_name {
        return Err("Nama merek sudah terdaftar.".to_string());
    }

    let duplicate_identifier: bool = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM brands
                WHERE LOWER(TRIM(identifier)) = LOWER(TRIM(?1))
            )",
            params![&normalized_identifier],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if duplicate_identifier {
        return Err("Identifier merek sudah digunakan.".to_string());
    }

    conn.execute(
        "INSERT INTO brands (id, name, identifier, origin, total_items) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![brand.id, normalized_name, normalized_identifier, brand.origin, brand.total_items],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_brand(state: State<DbState>, brand: Brand) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let normalized_name = brand.name.trim();
    let normalized_identifier = brand.identifier.trim().to_uppercase();

    if normalized_name.is_empty() {
        return Err("Nama merek wajib diisi.".to_string());
    }
    if normalized_identifier.is_empty() {
        return Err("Identifier merek wajib diisi.".to_string());
    }

    let duplicate_name: bool = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM brands
                WHERE LOWER(TRIM(name)) = LOWER(TRIM(?1))
                  AND id <> ?2
            )",
            params![normalized_name, &brand.id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if duplicate_name {
        return Err("Nama merek sudah terdaftar.".to_string());
    }

    let duplicate_identifier: bool = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM brands
                WHERE LOWER(TRIM(identifier)) = LOWER(TRIM(?1))
                  AND id <> ?2
            )",
            params![&normalized_identifier, &brand.id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if duplicate_identifier {
        return Err("Identifier merek sudah digunakan.".to_string());
    }

    conn.execute(
        "UPDATE brands SET name = ?1, identifier = ?2, origin = ?3, total_items = ?4 WHERE id = ?5",
        params![
            normalized_name,
            normalized_identifier,
            brand.origin,
            brand.total_items,
            brand.id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_brand(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM brands WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Partner Commands
#[tauri::command]
pub fn get_partners(state: State<DbState>) -> Result<Vec<Partner>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.code, p.name, p.partner_type, p.contact_person, p.phone,
                    p.email, p.address, p.is_active, u.username
             FROM partners p
             LEFT JOIN users u ON u.partner_id = p.id
             ORDER BY p.name COLLATE NOCASE ASC",
        )
        .map_err(|error| error.to_string())?;

    let partners_iter = stmt
        .query_map([], |row| {
            Ok(Partner {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                partner_type: row.get(3)?,
                contact_person: row.get(4)?,
                phone: row.get(5)?,
                email: row.get(6)?,
                address: row.get(7)?,
                is_active: row.get::<_, i32>(8)? != 0,
                username: row.get(9)?,
            })
        })
        .map_err(|error| error.to_string())?;

    let mut partners = Vec::new();
    for partner in partners_iter {
        partners.push(partner.map_err(|error| error.to_string())?);
    }

    Ok(partners)
}

#[tauri::command]
pub fn add_partner(state: State<DbState>, partner: Partner) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let normalized_code = normalize_identity_code(&partner.code)?;

    conn.execute(
        "INSERT INTO partners
         (id, code, name, partner_type, contact_person, phone, email, address, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            partner.id,
            normalized_code,
            partner.name,
            partner.partner_type,
            partner.contact_person,
            partner.phone,
            partner.email,
            partner.address,
            if partner.is_active { 1 } else { 0 },
        ],
    )
    .map_err(|error| error.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn update_partner(state: State<DbState>, partner: Partner) -> Result<(), String> {
    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let normalized_code = normalize_identity_code(&partner.code)?;
    let previous_name = tx
        .query_row(
            "SELECT name FROM partners WHERE id = ?1",
            params![&partner.id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    tx.execute(
        "UPDATE partners
         SET code = ?1, name = ?2, partner_type = ?3, contact_person = ?4,
             phone = ?5, email = ?6, address = ?7, is_active = ?8
         WHERE id = ?9",
        params![
            normalized_code,
            partner.name,
            partner.partner_type,
            partner.contact_person,
            partner.phone,
            partner.email,
            partner.address,
            if partner.is_active { 1 } else { 0 },
            partner.id,
        ],
    )
    .map_err(|error| error.to_string())?;

    tx.execute(
        "UPDATE users
         SET display_name = ?1, is_active = ?2
         WHERE partner_id = ?3",
        params![
            partner.name,
            if partner.is_active { 1 } else { 0 },
            partner.id
        ],
    )
    .map_err(|error| error.to_string())?;

    if let Some(previous_name) = previous_name {
        if previous_name != partner.name {
            tx.execute(
                "UPDATE items SET partner = ?1 WHERE partner = ?2 COLLATE NOCASE",
                params![&partner.name, &previous_name],
            )
            .map_err(|error| error.to_string())?;
            tx.execute(
                "UPDATE transactions SET partner = ?1 WHERE partner = ?2 COLLATE NOCASE",
                params![&partner.name, &previous_name],
            )
            .map_err(|error| error.to_string())?;
            tx.execute(
                "UPDATE storage_locations SET owner = ?1 WHERE owner = ?2 COLLATE NOCASE",
                params![&partner.name, &previous_name],
            )
            .map_err(|error| error.to_string())?;
        }
    }

    tx.commit().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_partner(state: State<DbState>, id: String) -> Result<(), String> {
    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|error| error.to_string())?;

    tx.execute("DELETE FROM users WHERE partner_id = ?1", params![&id])
        .map_err(|error| error.to_string())?;
    tx.execute(
        "UPDATE storage_locations
         SET owner = 'KP Tasikmalaya'
         WHERE owner = (SELECT name FROM partners WHERE id = ?1) COLLATE NOCASE",
        params![&id],
    )
    .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM partners WHERE id = ?1", params![id])
        .map_err(|error| error.to_string())?;

    tx.commit().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn add_partner_account(
    state: State<DbState>,
    partner: Partner,
    username: String,
    password: String,
) -> Result<(), String> {
    let normalized_username = username.trim();
    let normalized_code = normalize_identity_code(&partner.code)?;
    if normalized_username.len() < 4 {
        return Err("Username minimal 4 karakter.".to_string());
    }
    if password.len() < 8 {
        return Err("Password minimal 8 karakter.".to_string());
    }

    let password_hash = hash_password(&password)?;
    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|error| error.to_string())?;

    let username_exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM users WHERE username = ?1 COLLATE NOCASE)",
            params![normalized_username],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if username_exists {
        return Err("Username sudah digunakan.".to_string());
    }

    tx.execute(
        "INSERT INTO partners
         (id, code, name, partner_type, contact_person, phone, email, address, is_active)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &partner.id,
            normalized_code,
            &partner.name,
            &partner.partner_type,
            &partner.contact_person,
            &partner.phone,
            &partner.email,
            &partner.address,
            if partner.is_active { 1 } else { 0 },
        ],
    )
    .map_err(|error| error.to_string())?;

    tx.execute(
        "INSERT INTO users
         (id, username, password_hash, role, display_name, partner_id, is_active)
         VALUES (?1, ?2, ?3, 'mitra', ?4, ?5, ?6)",
        params![
            format!("user-{}", partner.id),
            normalized_username,
            password_hash,
            &partner.name,
            &partner.id,
            if partner.is_active { 1 } else { 0 },
        ],
    )
    .map_err(|error| error.to_string())?;

    tx.commit().map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_partner_account(
    state: State<DbState>,
    partner: Partner,
    username: String,
    password: Option<String>,
) -> Result<(), String> {
    let normalized_username = username.trim();
    let normalized_code = normalize_identity_code(&partner.code)?;
    if normalized_username.len() < 4 {
        return Err("Username minimal 4 karakter.".to_string());
    }
    if password.as_ref().is_some_and(|value| value.len() < 8) {
        return Err("Password minimal 8 karakter.".to_string());
    }

    let new_password_hash = password
        .as_deref()
        .filter(|value| !value.is_empty())
        .map(hash_password)
        .transpose()?;
    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|error| error.to_string())?;
    let previous_name = tx
        .query_row(
            "SELECT name FROM partners WHERE id = ?1",
            params![&partner.id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|error| error.to_string())?;

    let username_exists: bool = tx
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM users
                WHERE username = ?1 COLLATE NOCASE
                  AND (partner_id IS NULL OR partner_id <> ?2)
            )",
            params![normalized_username, &partner.id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if username_exists {
        return Err("Username sudah digunakan.".to_string());
    }

    tx.execute(
        "UPDATE partners
         SET code = ?1, name = ?2, partner_type = ?3, contact_person = ?4,
             phone = ?5, email = ?6, address = ?7, is_active = ?8
         WHERE id = ?9",
        params![
            normalized_code,
            &partner.name,
            &partner.partner_type,
            &partner.contact_person,
            &partner.phone,
            &partner.email,
            &partner.address,
            if partner.is_active { 1 } else { 0 },
            &partner.id,
        ],
    )
    .map_err(|error| error.to_string())?;

    let account_exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM users WHERE partner_id = ?1)",
            params![&partner.id],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;

    if account_exists {
        tx.execute(
            "UPDATE users
             SET username = ?1, display_name = ?2, is_active = ?3
             WHERE partner_id = ?4",
            params![
                normalized_username,
                &partner.name,
                if partner.is_active { 1 } else { 0 },
                &partner.id
            ],
        )
        .map_err(|error| error.to_string())?;

        if let Some(password_hash) = new_password_hash {
            tx.execute(
                "UPDATE users SET password_hash = ?1 WHERE partner_id = ?2",
                params![password_hash, &partner.id],
            )
            .map_err(|error| error.to_string())?;
        }
    } else {
        let Some(password_hash) = new_password_hash else {
            return Err(
                "Mitra lama ini belum memiliki akun. Isi password untuk membuat akun.".to_string(),
            );
        };

        tx.execute(
            "INSERT INTO users
             (id, username, password_hash, role, display_name, partner_id, is_active)
             VALUES (?1, ?2, ?3, 'mitra', ?4, ?5, ?6)",
            params![
                format!("user-{}", partner.id),
                normalized_username,
                password_hash,
                &partner.name,
                &partner.id,
                if partner.is_active { 1 } else { 0 },
            ],
        )
        .map_err(|error| error.to_string())?;
    }

    if let Some(previous_name) = previous_name {
        if previous_name != partner.name {
            tx.execute(
                "UPDATE items SET partner = ?1 WHERE partner = ?2 COLLATE NOCASE",
                params![&partner.name, &previous_name],
            )
            .map_err(|error| error.to_string())?;
            tx.execute(
                "UPDATE transactions SET partner = ?1 WHERE partner = ?2 COLLATE NOCASE",
                params![&partner.name, &previous_name],
            )
            .map_err(|error| error.to_string())?;
            tx.execute(
                "UPDATE storage_locations SET owner = ?1 WHERE owner = ?2 COLLATE NOCASE",
                params![&partner.name, &previous_name],
            )
            .map_err(|error| error.to_string())?;
        }
    }

    tx.commit().map_err(|error| error.to_string())
}

// Storage Location Structs & Commands
#[derive(Serialize, Deserialize, Clone)]
pub struct Level {
    pub id: String,
    pub name: String,
    pub capacity: i32,
    #[serde(rename = "usedCapacity")]
    pub used_capacity: i32,
    #[serde(rename = "brandRule")]
    pub brand_rule: String,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct StorageLocation {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub location_type: String, // "Rak" or "Kardus"
    #[serde(rename = "isActive")]
    pub is_active: bool,
    pub levels: Option<Vec<Level>>,
    pub capacity: Option<i32>,
    #[serde(rename = "usedCapacity")]
    pub used_capacity: Option<i32>,
    #[serde(rename = "brandRule")]
    pub brand_rule: Option<String>,
    pub owner: String,
}

#[tauri::command]
pub fn get_locations(state: State<DbState>) -> Result<Vec<StorageLocation>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, name, type, is_active, capacity, used_capacity, brand_rule, owner FROM storage_locations").map_err(|e| e.to_string())?;

    let locations_iter = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let name: String = row.get(1)?;
            let location_type: String = row.get(2)?;
            let is_active_val: i32 = row.get(3)?;
            let is_active = is_active_val != 0;
            let capacity: Option<i32> = row.get(4)?;
            let used_capacity: Option<i32> = row.get(5)?;
            let brand_rule: Option<String> = row.get(6)?;
            let owner: String = row.get(7)?;

            Ok(StorageLocation {
                id,
                name,
                location_type,
                is_active,
                levels: None,
                capacity,
                used_capacity,
                brand_rule,
                owner,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut locations = Vec::new();
    for loc_res in locations_iter {
        let mut loc = loc_res.map_err(|e| e.to_string())?;
        if loc.location_type == "Rak" {
            let mut lvl_stmt = conn.prepare("SELECT id, name, capacity, used_capacity, brand_rule, is_active FROM storage_levels WHERE location_id = ?1").map_err(|e| e.to_string())?;
            let lvls_iter = lvl_stmt
                .query_map(params![loc.id], |r| {
                    let is_active_val: i32 = r.get(5)?;
                    Ok(Level {
                        id: r.get(0)?,
                        name: r.get(1)?,
                        capacity: r.get(2)?,
                        used_capacity: r.get(3)?,
                        brand_rule: r.get(4)?,
                        is_active: is_active_val != 0,
                    })
                })
                .map_err(|e| e.to_string())?;

            let mut lvls = Vec::new();
            for lvl in lvls_iter {
                lvls.push(lvl.map_err(|e| e.to_string())?);
            }
            loc.levels = Some(lvls);
        }
        locations.push(loc);
    }

    Ok(locations)
}

#[tauri::command]
pub fn save_location(state: State<DbState>, location: StorageLocation) -> Result<(), String> {
    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Check if location already exists
    let exists: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM storage_locations WHERE id = ?1)",
            params![location.id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if exists {
        tx.execute(
            "UPDATE storage_locations SET name = ?1, type = ?2, is_active = ?3, capacity = ?4, used_capacity = ?5, brand_rule = ?6, owner = ?7 WHERE id = ?8",
            params![
                location.name,
                location.location_type,
                if location.is_active { 1 } else { 0 },
                location.capacity,
                location.used_capacity,
                location.brand_rule,
                location.owner,
                location.id
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        tx.execute(
            "INSERT INTO storage_locations (id, name, type, is_active, capacity, used_capacity, brand_rule, owner) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                location.id,
                location.name,
                location.location_type,
                if location.is_active { 1 } else { 0 },
                location.capacity,
                location.used_capacity,
                location.brand_rule,
                location.owner
            ],
        ).map_err(|e| e.to_string())?;
    }

    // Upsert levels if present
    if let Some(levels) = location.levels {
        for level in levels {
            let lvl_exists: bool = tx
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM storage_levels WHERE id = ?1)",
                    params![level.id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;

            if lvl_exists {
                tx.execute(
                    "UPDATE storage_levels SET name = ?1, capacity = ?2, used_capacity = ?3, brand_rule = ?4, is_active = ?5 WHERE id = ?6",
                    params![
                        level.name,
                        level.capacity,
                        level.used_capacity,
                        level.brand_rule,
                        if level.is_active { 1 } else { 0 },
                        level.id
                    ],
                ).map_err(|e| e.to_string())?;
            } else {
                tx.execute(
                    "INSERT INTO storage_levels (id, location_id, name, capacity, used_capacity, brand_rule, is_active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        level.id,
                        location.id,
                        level.name,
                        level.capacity,
                        level.used_capacity,
                        level.brand_rule,
                        if level.is_active { 1 } else { 0 }
                    ],
                ).map_err(|e| e.to_string())?;
            }
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_location(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM storage_locations WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn save_level(state: State<DbState>, level: Level, location_id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM storage_levels WHERE id = ?1)",
            params![level.id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if exists {
        conn.execute(
            "UPDATE storage_levels SET name = ?1, capacity = ?2, used_capacity = ?3, brand_rule = ?4, is_active = ?5 WHERE id = ?6",
            params![
                level.name,
                level.capacity,
                level.used_capacity,
                level.brand_rule,
                if level.is_active { 1 } else { 0 },
                level.id
            ],
        ).map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "INSERT INTO storage_levels (id, location_id, name, capacity, used_capacity, brand_rule, is_active) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                level.id,
                location_id,
                level.name,
                level.capacity,
                level.used_capacity,
                level.brand_rule,
                if level.is_active { 1 } else { 0 }
            ],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn delete_level(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM storage_levels WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_location_active(
    state: State<DbState>,
    id: String,
    is_active: bool,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE storage_locations SET is_active = ?1 WHERE id = ?2",
        params![if is_active { 1 } else { 0 }, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn toggle_level_active(
    state: State<DbState>,
    id: String,
    is_active: bool,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE storage_levels SET is_active = ?1 WHERE id = ?2",
        params![if is_active { 1 } else { 0 }, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Item Commands
#[derive(Serialize, Deserialize)]
pub struct Item {
    pub id: String,
    #[serde(rename = "serialNumber")]
    pub serial_number: String,
    #[serde(rename = "kategori")]
    pub category: String,
    #[serde(rename = "merek")]
    pub brand: String,
    pub status: String,
    #[serde(rename = "lokasiPenyimpanan")]
    pub storage_location: String,
    #[serde(rename = "tanggalMasuk")]
    pub entry_date: String,
    #[serde(rename = "tanggalKeluar")]
    pub exit_date: Option<String>,
    pub mitra: Option<String>,
}

#[tauri::command]
pub fn get_items(state: State<DbState>) -> Result<Vec<Item>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, serial_number, category, brand, status, storage_location, entry_date, exit_date, partner FROM items").map_err(|e| e.to_string())?;

    let items_iter = stmt
        .query_map([], |row| {
            Ok(Item {
                id: row.get(0)?,
                serial_number: row.get(1)?,
                category: row.get(2)?,
                brand: row.get(3)?,
                status: row.get(4)?,
                storage_location: row.get(5)?,
                entry_date: row.get(6)?,
                exit_date: row.get(7)?,
                mitra: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for item in items_iter {
        items.push(item.map_err(|e| e.to_string())?);
    }

    Ok(items)
}

#[tauri::command]
pub fn add_item(state: State<DbState>, item: Item) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO items (id, serial_number, category, brand, status, storage_location, entry_date, exit_date, partner) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![item.id, item.serial_number, item.category, item.brand, item.status, item.storage_location, item.entry_date, item.exit_date, item.mitra],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_item(state: State<DbState>, item: Item) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE items SET serial_number = ?1, category = ?2, brand = ?3, status = ?4, storage_location = ?5, entry_date = ?6, exit_date = ?7, partner = ?8 WHERE id = ?9",
        params![item.serial_number, item.category, item.brand, item.status, item.storage_location, item.entry_date, item.exit_date, item.mitra, item.id],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_item(state: State<DbState>, id: String) -> Result<(), String> {
    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let serial_number = tx
        .query_row(
            "SELECT serial_number FROM items WHERE id = ?1",
            params![id],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(serial_number) = serial_number {
        tx.execute(
            "DELETE FROM transactions WHERE serial_number = ?1",
            params![serial_number],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute("DELETE FROM items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// Transaction Commands
#[derive(Serialize, Deserialize)]
pub struct Transaction {
    pub id: String,
    pub tanggal: String,
    pub nomor: String,
    pub kategori: String,
    pub status: String,
    pub sn: String,
    pub merek: String,
    pub asal: Option<String>,
    pub tujuan: Option<String>,
    pub mitra: Option<String>,
    pub keterangan: Option<String>,
}

#[tauri::command]
pub fn get_transactions(state: State<DbState>) -> Result<Vec<Transaction>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn.prepare("SELECT id, transaction_date, transaction_number, category, status, serial_number, brand, origin, destination, partner, note FROM transactions ORDER BY transaction_date DESC, rowid DESC").map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(Transaction {
                id: row.get(0)?,
                tanggal: row.get(1)?,
                nomor: row.get(2)?,
                kategori: row.get(3)?,
                status: row.get(4)?,
                sn: row.get(5)?,
                merek: row.get(6)?,
                asal: row.get(7)?,
                tujuan: row.get(8)?,
                mitra: row.get(9)?,
                keterangan: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut transactions = Vec::new();
    for t in iter {
        transactions.push(t.map_err(|e| e.to_string())?);
    }
    Ok(transactions)
}

#[tauri::command]
pub fn add_transaction(state: State<DbState>, transaction: Transaction) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO transactions (id, transaction_date, transaction_number, category, status, serial_number, brand, origin, destination, partner, note) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![transaction.id, transaction.tanggal, transaction.nomor, transaction.kategori, transaction.status, transaction.sn, transaction.merek, transaction.asal, transaction.tujuan, transaction.mitra, transaction.keterangan],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_transaction(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM transactions WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Notification Commands
#[derive(Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub title: String,
    pub message: String,
    #[serde(rename = "type")]
    pub notif_type: String,
    pub date: String,
    #[serde(rename = "isRead")]
    pub is_read: bool,
}

#[tauri::command]
pub fn get_notifications(state: State<DbState>) -> Result<Vec<Notification>, String> {
    let conn = state.0.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT id, title, message, type, date, is_read FROM notifications ORDER BY datetime(date) DESC, rowid DESC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            let is_read_val: i32 = row.get(5)?;
            Ok(Notification {
                id: row.get(0)?,
                title: row.get(1)?,
                message: row.get(2)?,
                notif_type: row.get(3)?,
                date: row.get(4)?,
                is_read: is_read_val != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut notifications = Vec::new();
    for n in iter {
        notifications.push(n.map_err(|e| e.to_string())?);
    }
    Ok(notifications)
}

#[tauri::command]
pub fn add_notification(state: State<DbState>, notification: Notification) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "INSERT INTO notifications (id, title, message, type, date, is_read) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![notification.id, notification.title, notification.message, notification.notif_type, notification.date, if notification.is_read { 1 } else { 0 }],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn mark_notification_read(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "UPDATE notifications SET is_read = 1 WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn mark_all_notifications_read(state: State<DbState>) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("UPDATE notifications SET is_read = 1", [])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_notification(state: State<DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute("DELETE FROM notifications WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn google_oauth_login(client_id: String) -> Result<String, String> {
    let redirect_uri = "http://localhost:3456";

    // Build Google OAuth2 consent URL
    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        urlencoding(&client_id),
        urlencoding(redirect_uri),
        urlencoding("https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile"),
    );

    // Start a temporary HTTP server to capture the callback
    let server = tiny_http::Server::http("127.0.0.1:3456")
        .map_err(|e| format!("Gagal memulai server lokal OAuth: {}", e))?;

    // Open the consent URL in the OS's default browser
    open::that(&auth_url).map_err(|e| format!("Gagal membuka browser: {}", e))?;

    // Wait for Google to redirect back (blocks until a request arrives)
    let request = server
        .recv()
        .map_err(|e| format!("Gagal menerima callback OAuth: {}", e))?;

    // Parse the URL to extract the `code` query parameter
    let request_url = format!("http://localhost:3456{}", request.url());
    let parsed = url::Url::parse(&request_url)
        .map_err(|e| format!("Gagal parsing URL callback: {}", e))?;

    let code = parsed
        .query_pairs()
        .find(|(key, _)| key == "code")
        .map(|(_, value)| value.to_string())
        .ok_or_else(|| {
            // Check if there's an error parameter from Google
            let error = parsed
                .query_pairs()
                .find(|(key, _)| key == "error")
                .map(|(_, value)| value.to_string())
                .unwrap_or_else(|| "tidak diketahui".to_string());
            format!("Google OAuth gagal: {}", error)
        })?;

    // Respond to the browser with a success page
    let success_html = r#"
        <html>
        <head>
            <meta charset="utf-8">
            <title>Arxiva - OAuth Berhasil</title>
            <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #fafafa; }
                .card { text-align: center; padding: 3rem; border-radius: 1rem; background: #171717; border: 1px solid #262626; max-width: 400px; }
                .icon { font-size: 3rem; margin-bottom: 1rem; }
                h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
                p { color: #a3a3a3; font-size: 0.875rem; margin: 0; }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">✅</div>
                <h1>Otentikasi Berhasil!</h1>
                <p>Silakan kembali ke aplikasi Arxiva.<br>Jendela ini dapat ditutup.</p>
            </div>
        </body>
        </html>
    "#;

    let response = tiny_http::Response::from_string(success_html)
        .with_header(
            tiny_http::Header::from_bytes(b"Content-Type", b"text/html; charset=utf-8").unwrap(),
        );
    let _ = request.respond(response);

    // Server is dropped here, automatically shutting down
    drop(server);

    Ok(code)
}

/// Simple percent-encoding for URL parameters
fn urlencoding(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 3);
    for byte in s.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            _ => {
                result.push('%');
                result.push_str(&format!("{:02X}", byte));
            }
        }
    }
    result
}
