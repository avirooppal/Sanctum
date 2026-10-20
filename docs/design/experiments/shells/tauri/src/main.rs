#[tauri::command]
fn ready() {
    println!("SANCTUM_LAB_READY");
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![ready])
        .run(tauri::generate_context!())
        .expect("shell experiment");
}
