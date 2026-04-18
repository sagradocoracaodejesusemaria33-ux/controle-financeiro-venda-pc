use tauri::{Emitter, LogicalSize, Manager, Size, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri::utils::config::Color;
use tauri_plugin_opener::OpenerExt;

const SALES_PORTAL_URL: &str = "https://controle-financeiro-familiar-sales.onrender.com";

#[cfg(windows)]
fn apply_auth_window_frame(window: &tauri::WebviewWindow) {
    use std::mem::size_of;
    use windows::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_WINDOW_CORNER_PREFERENCE,
        DWMWCP_DONOTROUND,
    };

    if let Ok(hwnd) = window.hwnd() {
        let border_color: u32 = (152u32 << 16) | (59u32 << 8) | 18u32;
        let corner_preference = DWMWCP_DONOTROUND;

        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_WINDOW_CORNER_PREFERENCE,
                &corner_preference as *const _ as _,
                size_of::<windows::Win32::Graphics::Dwm::DWM_WINDOW_CORNER_PREFERENCE>() as _,
            );
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_BORDER_COLOR,
                &border_color as *const _ as _,
                size_of::<u32>() as _,
            );
        }
    }
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn close_window(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    if window.label() == "auth" {
        app.exit(0);
        return Ok(());
    }

    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn finish_auth(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<(), String> {
    let main = app
        .get_webview_window("main")
        .ok_or_else(|| "Janela principal nao encontrada.".to_string())?;

    main.emit("auth-unlock", ()).map_err(|e| e.to_string())?;
    main.show().map_err(|e| e.to_string())?;
    main.set_focus().map_err(|e| e.to_string())?;
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
fn resize_window(window: tauri::WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(Size::Logical(LogicalSize::new(width, height)))
        .map_err(|e| e.to_string())?;
    window.center().map_err(|e| e.to_string())
}

#[tauri::command]
fn show_window(window: tauri::WebviewWindow) -> Result<(), String> {
    window.center().map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
fn open_purchase_portal(app: tauri::AppHandle, registration_code: String) -> Result<(), String> {
    let normalized = registration_code.trim().to_uppercase();
    let url = format!(
        "{}/?registrationCode={}",
        SALES_PORTAL_URL.trim_end_matches('/'),
        normalized
    );

    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Some(main) = app.get_webview_window("main") {
                main.hide()?;
            }

            let auth = WebviewWindowBuilder::new(app, "auth", WebviewUrl::App("login.html".into()))
                .title("Acesso - Controle Financeiro Familiar")
                .inner_size(360.0, 580.0)
                .visible(false)
                .background_color(Color(18, 59, 152, 255))
                .resizable(false)
                .decorations(false)
                .shadow(false)
                .always_on_top(true)
                .center()
                .build()?;

            #[cfg(windows)]
            apply_auth_window_frame(&auth);

            let app_handle = app.handle().clone();
            auth.on_window_event(move |event| {
                if let WindowEvent::CloseRequested { .. } = event {
                    let should_exit = app_handle
                        .get_webview_window("main")
                        .and_then(|main| main.is_visible().ok())
                        .map(|visible| !visible)
                        .unwrap_or(true);

                    if should_exit {
                        app_handle.exit(0);
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            close_window,
            finish_auth,
            resize_window,
            show_window,
            open_purchase_portal
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}
