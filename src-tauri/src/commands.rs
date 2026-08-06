use std::path::PathBuf;
use tauri::Manager;

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
