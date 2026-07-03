use crate::auth::hash_password;
use rusqlite::{Connection, Result};
use std::path::PathBuf;
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

fn column_exists(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;

    for current_column in columns {
        if current_column? == column {
            return Ok(true);
        }
    }

    Ok(false)
}

pub fn init_db(db_path: PathBuf) -> Result<Connection> {
    let conn = Connection::open(db_path)?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            total_items INTEGER DEFAULT 0,
            safety_stock INTEGER NOT NULL DEFAULT 5
        )",
        [],
    )?;

    if !column_exists(&conn, "categories", "safety_stock")? {
        conn.execute(
            "ALTER TABLE categories ADD COLUMN safety_stock INTEGER NOT NULL DEFAULT 5",
            [],
        )?;
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS brands (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            identifier TEXT NOT NULL DEFAULT '',
            origin TEXT NOT NULL,
            total_items INTEGER DEFAULT 0
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS partners (
            id TEXT PRIMARY KEY,
            code TEXT NOT NULL DEFAULT '',
            name TEXT NOT NULL,
            partner_type TEXT NOT NULL,
            contact_person TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT NOT NULL,
            address TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        )",
        [],
    )?;

    if !column_exists(&conn, "partners", "code")? {
        conn.execute(
            "ALTER TABLE partners ADD COLUMN code TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }

    conn.execute(
        "UPDATE partners
         SET code = 'MTR-' || PRINTF('%03d', rowid)
         WHERE code IS NULL OR TRIM(code) = ''",
        [],
    )?;

    conn.execute("DROP INDEX IF EXISTS idx_partners_unique_code", [])?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    conn.execute(
        "INSERT OR IGNORE INTO app_settings (key, value)
         VALUES ('kp_identity_code', 'KP Tasikmalaya')",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL COLLATE NOCASE UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'mitra')),
            display_name TEXT NOT NULL,
            partner_id TEXT UNIQUE,
            is_active INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (partner_id) REFERENCES partners (id) ON DELETE CASCADE
        )",
        [],
    )?;

    let admin_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM users WHERE role = 'admin')",
        [],
        |row| row.get(0),
    )?;

    if !admin_exists {
        let password_hash =
            hash_password("Admin123!").map_err(|_| rusqlite::Error::InvalidQuery)?;
        conn.execute(
            "INSERT INTO users
             (id, username, password_hash, role, display_name, partner_id, is_active)
             VALUES ('user-admin-default', 'admin', ?1, 'admin', 'Administrator', NULL, 1)",
            [&password_hash],
        )?;
    }

    let has_brand_identifier = {
        let mut stmt = conn.prepare("PRAGMA table_info(brands)")?;
        let columns = stmt.query_map([], |row| row.get::<_, String>(1))?;
        let mut has_column = false;

        for column in columns {
            if column? == "identifier" {
                has_column = true;
                break;
            }
        }

        has_column
    };

    if !has_brand_identifier {
        conn.execute(
            "ALTER TABLE brands ADD COLUMN identifier TEXT NOT NULL DEFAULT ''",
            [],
        )?;
    }

    conn.execute(
        "UPDATE brands
         SET identifier = UPPER(SUBSTR(TRIM(name), 1, 3))
         WHERE identifier IS NULL OR TRIM(identifier) = ''",
        [],
    )?;

    conn.execute(
        "DELETE FROM categories
         WHERE rowid NOT IN (
             SELECT MIN(rowid)
             FROM categories
             GROUP BY LOWER(TRIM(name))
         )",
        [],
    )?;

    conn.execute(
        "DELETE FROM brands
         WHERE rowid NOT IN (
             SELECT MIN(rowid)
             FROM brands
             GROUP BY LOWER(TRIM(name))
         )",
        [],
    )?;

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_unique_name
         ON categories(LOWER(TRIM(name)))",
        [],
    )?;

    conn.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_unique_name
         ON brands(LOWER(TRIM(name)))",
        [],
    )?;

    let duplicate_brand_identifiers: i64 = conn.query_row(
        "SELECT COUNT(*)
         FROM (
             SELECT LOWER(TRIM(identifier))
             FROM brands
             GROUP BY LOWER(TRIM(identifier))
             HAVING COUNT(*) > 1
         )",
        [],
        |row| row.get(0),
    )?;

    if duplicate_brand_identifiers == 0 {
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_brands_unique_identifier
             ON brands(LOWER(TRIM(identifier)))",
            [],
        )?;
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS storage_locations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            capacity INTEGER,
            used_capacity INTEGER,
            brand_rule TEXT,
            owner TEXT NOT NULL DEFAULT 'KP Tasikmalaya'
        )",
        [],
    )?;

    if !column_exists(&conn, "storage_locations", "owner")? {
        conn.execute(
            "ALTER TABLE storage_locations ADD COLUMN owner TEXT NOT NULL DEFAULT 'KP Tasikmalaya'",
            [],
        )?;
    }

    conn.execute(
        "UPDATE storage_locations
         SET owner = 'KP Tasikmalaya'
         WHERE owner IS NULL OR TRIM(owner) = ''",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS storage_levels (
            id TEXT PRIMARY KEY,
            location_id TEXT NOT NULL,
            name TEXT NOT NULL,
            capacity INTEGER NOT NULL,
            used_capacity INTEGER NOT NULL DEFAULT 0,
            brand_rule TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (location_id) REFERENCES storage_locations (id) ON DELETE CASCADE
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            serial_number TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL,
            brand TEXT NOT NULL,
            status TEXT NOT NULL,
            storage_location TEXT NOT NULL,
            entry_date TEXT NOT NULL,
            exit_date TEXT,
            partner TEXT
        )",
        [],
    )?;

    if !column_exists(&conn, "items", "partner")? {
        conn.execute("ALTER TABLE items ADD COLUMN partner TEXT", [])?;
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            transaction_date TEXT NOT NULL,
            transaction_number TEXT NOT NULL,
            category TEXT NOT NULL,
            status TEXT NOT NULL,
            serial_number TEXT NOT NULL,
            brand TEXT NOT NULL,
            origin TEXT,
            destination TEXT,
            partner TEXT,
            note TEXT
        )",
        [],
    )?;

    if !column_exists(&conn, "transactions", "partner")? {
        conn.execute("ALTER TABLE transactions ADD COLUMN partner TEXT", [])?;
    }

    if !column_exists(&conn, "transactions", "note")? {
        conn.execute("ALTER TABLE transactions ADD COLUMN note TEXT", [])?;
    }

    conn.execute(
        "UPDATE items
         SET partner = (
             SELECT transactions.partner
             FROM transactions
             WHERE LOWER(TRIM(transactions.serial_number)) =
                   LOWER(TRIM(items.serial_number))
               AND transactions.partner IS NOT NULL
               AND TRIM(transactions.partner) <> ''
             ORDER BY transactions.transaction_date DESC, transactions.rowid DESC
             LIMIT 1
         )
         WHERE partner IS NULL OR TRIM(partner) = ''",
        [],
    )?;

    conn.execute(
        "UPDATE items
         SET partner = 'KP Tasikmalaya'
         WHERE partner IS NULL OR TRIM(partner) = ''",
        [],
    )?;

    if column_exists(&conn, "items", "operator")? {
        conn.execute("ALTER TABLE items DROP COLUMN operator", [])?;
    }

    if column_exists(&conn, "transactions", "operator")? {
        conn.execute("ALTER TABLE transactions DROP COLUMN operator", [])?;
    }

    conn.execute(
        "CREATE TABLE IF NOT EXISTS notifications (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT NOT NULL,
            date TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0
        )",
        [],
    )?;

    

    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::init_db;
    use rusqlite::{params, Connection};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn legacy_inventory_is_migrated_with_partner_and_note_columns() {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let db_path = std::env::temp_dir().join(format!(
            "inventory-management-migration-{}-{unique_suffix}.db",
            std::process::id()
        ));

        let legacy_conn = Connection::open(&db_path).unwrap();
        legacy_conn
            .execute_batch(
                "CREATE TABLE categories (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    description TEXT NOT NULL,
                    total_items INTEGER DEFAULT 0
                );
                INSERT INTO categories (id, name, description, total_items)
                VALUES ('category-1', 'Router', 'Perangkat router', 0);
                CREATE TABLE partners (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    partner_type TEXT NOT NULL,
                    contact_person TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT NOT NULL,
                    address TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1
                );
                INSERT INTO partners
                    (id, name, partner_type, contact_person, phone, email, address, is_active)
                VALUES
                    ('partner-1', 'Mitra Lama', 'Vendor', '-', '-', '-', '-', 1);
                CREATE TABLE storage_locations (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    type TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    capacity INTEGER,
                    used_capacity INTEGER,
                    brand_rule TEXT
                );
                INSERT INTO storage_locations
                    (id, name, type, is_active, capacity, used_capacity, brand_rule)
                VALUES ('location-1', 'Rak Lama', 'Kardus', 1, 10, 0, 'Campuran');
                CREATE TABLE items (
                    id TEXT PRIMARY KEY,
                    serial_number TEXT NOT NULL UNIQUE,
                    category TEXT NOT NULL,
                    brand TEXT NOT NULL,
                    status TEXT NOT NULL,
                    storage_location TEXT NOT NULL,
                    entry_date TEXT NOT NULL,
                    exit_date TEXT
                );
                CREATE TABLE transactions (
                    id TEXT PRIMARY KEY,
                    transaction_date TEXT NOT NULL,
                    transaction_number TEXT NOT NULL,
                    category TEXT NOT NULL,
                    status TEXT NOT NULL,
                    serial_number TEXT NOT NULL,
                    brand TEXT NOT NULL,
                    origin TEXT,
                    destination TEXT,
                    partner TEXT
                );",
            )
            .unwrap();
        legacy_conn
            .execute(
                "INSERT INTO items
                 (id, serial_number, category, brand, status, storage_location, entry_date)
                 VALUES ('item-1', 'SN-001', 'Router', 'Contoh', 'Keluar', 'Keluar', '2026-01-01')",
                [],
            )
            .unwrap();
        legacy_conn
            .execute(
                "INSERT INTO items
                 (id, serial_number, category, brand, status, storage_location, entry_date)
                 VALUES ('item-2', 'SN-002', 'Router', 'Contoh', 'Masuk', 'Rak A', '2026-01-01')",
                [],
            )
            .unwrap();
        legacy_conn
            .execute(
                "INSERT INTO transactions
                 (id, transaction_date, transaction_number, category, status, serial_number,
                  brand, origin, destination, partner)
                 VALUES (?1, ?2, ?3, 'Keluar', 'Selesai', 'SN-001', 'Contoh',
                         'Gudang', 'Keluar', 'Mitra Contoh')",
                params!["trx-1", "2026-01-02", "OUT-001"],
            )
            .unwrap();
        drop(legacy_conn);

        let migrated_conn = init_db(db_path.clone()).unwrap();
        let partner: Option<String> = migrated_conn
            .query_row("SELECT partner FROM items WHERE id = 'item-1'", [], |row| {
                row.get(0)
            })
            .unwrap();
        let note_column_exists: bool = migrated_conn
            .query_row(
                "SELECT EXISTS(
                    SELECT 1 FROM pragma_table_info('transactions') WHERE name = 'note'
                )",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let admin_location: Option<String> = migrated_conn
            .query_row("SELECT partner FROM items WHERE id = 'item-2'", [], |row| {
                row.get(0)
            })
            .unwrap();
        let safety_stock: i32 = migrated_conn
            .query_row(
                "SELECT safety_stock FROM categories WHERE id = 'category-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let location_owner: String = migrated_conn
            .query_row(
                "SELECT owner FROM storage_locations WHERE id = 'location-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let partner_code: String = migrated_conn
            .query_row(
                "SELECT code FROM partners WHERE id = 'partner-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let kp_code: String = migrated_conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = 'kp_identity_code'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        migrated_conn
            .execute(
                "INSERT INTO partners
                 (id, code, name, partner_type, contact_person, phone, email, address, is_active)
                 VALUES ('partner-2', ?1, 'Mitra Duplikat', 'Vendor', '-', '-', '-', '-', 1)",
                params![&partner_code],
            )
            .unwrap();
        let duplicate_code_count: i32 = migrated_conn
            .query_row(
                "SELECT COUNT(*) FROM partners WHERE code = ?1 COLLATE NOCASE",
                params![&partner_code],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(partner.as_deref(), Some("Mitra Contoh"));
        assert_eq!(admin_location.as_deref(), Some("KP Tasikmalaya"));
        assert_eq!(safety_stock, 5);
        assert_eq!(location_owner, "KP Tasikmalaya");
        assert_eq!(partner_code, "MTR-001");
        assert_eq!(kp_code, "KP Tasikmalaya");
        assert_eq!(duplicate_code_count, 2);
        assert!(note_column_exists);

        drop(migrated_conn);
        std::fs::remove_file(db_path).unwrap();
    }
}
