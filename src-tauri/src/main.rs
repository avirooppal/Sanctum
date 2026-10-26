// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Configure hardened WebView2 settings on the main window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.with_webview(|webview| {
                    #[cfg(target_os = "windows")]
                    unsafe {
                        if let Ok(core) = webview.controller().CoreWebView2() {
                            if let Ok(settings) = core.Settings() {
                                let _ = settings.SetAreBrowserAcceleratorKeysEnabled(false);
                                let _ = settings.SetAreDefaultContextMenusEnabled(false);
                                let _ = settings.SetAreDevToolsEnabled(cfg!(debug_assertions));
                                let _ = settings.SetIsStatusBarEnabled(false);
                                let _ = settings.SetIsZoomControlEnabled(false);
                                let _ = settings.SetIsBuiltInErrorPageEnabled(false);
                            }
                        }
                    }
                });
                let _ = window.show();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Sanctum desktop application");
}
