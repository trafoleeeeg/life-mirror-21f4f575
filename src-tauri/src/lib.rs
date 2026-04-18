use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // single-instance ДОЛЖЕН быть первым плагином.
    // При запуске второй копии (например, при клике mirr://callback?code=...)
    // — этот колбэк выполнится в УЖЕ ЗАПУЩЕННОЙ копии и пробросит deep-link во фронт.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // Поднимаем основное окно
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
            // Ищем mirr://... в args и пробрасываем во фронт через event
            for arg in args.iter() {
                if arg.starts_with("mirr://") {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("deep-link://new-url", vec![arg.clone()]);
                    }
                }
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // На Linux/Windows регистрируем схему динамически на старте (для dev/portable)
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
