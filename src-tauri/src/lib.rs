mod telemetry;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
fn force_quit(app: tauri::AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // SQLite Migrations
    // ==================
    // Migrations run automatically on Database.load() in order of version number.
    // Each database file maintains its own migration state.
    //
    // To add a new migration:
    // 1. Create file: migrations/00X_description.sql
    // 2. Add Migration entry below with incremented version
    // 3. Use "IF NOT EXISTS" in CREATE statements for idempotency
    // 4. Test migration on existing populated database before release
    //
    // IMPORTANT: Never modify existing migration files - only add new ones.
    // tauri-plugin-sql tracks applied migrations in _sqlx_migrations table.
    //
    // Note: Dynamic paths are handled in database.ts. The placeholder path
    // "sqlite:ticketflow.db" is overwritten per-project at runtime.
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:ticketflow.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // When a second instance is launched, show the existing window
            if let Some(window) = app.get_webview_window("main") {
                window.show().ok();
                window.unminimize().ok();
                window.set_focus().ok();
            }
        }))
        .invoke_handler(tauri::generate_handler![force_quit, telemetry::ph_send_batch])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Prevent window close, hide to tray instead
                api.prevent_close();
                window.hide().ok();
            }
        })
        .setup(|app| {
            // Debug logging (dev only)
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize telemetry DB (separate from the main app DB managed by tauri-plugin-sql)
            let data_dir = app.path().app_data_dir()
                .expect("app data dir unavailable");
            let telemetry_pool = tauri::async_runtime::block_on(
                telemetry::init_telemetry_db(&data_dir)
            );
            app.manage(telemetry::TelemetryState {
                pool: telemetry_pool,
                api_host: "https://eu.i.posthog.com".to_string(),
            });
            // Flush any events that were queued before the last shutdown.
            tauri::async_runtime::block_on(
                telemetry::startup_flush(app.state::<telemetry::TelemetryState>())
            );

            // Tray menu items
            let open_item = MenuItem::with_id(app, "open", "Ouvrir Ticketflow", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &quit_item])?;

            // Build tray icon
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("Ticketflow")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if let Some(window) = app.get_webview_window("main") {
                        match event.id.as_ref() {
                            "open" => {
                                window.show().ok();
                                window.unminimize().ok();
                                window.set_focus().ok();
                            }
                            "quit" => {
                                // Show window first so user can see the confirmation modal
                                window.show().ok();
                                window.unminimize().ok();
                                window.set_focus().ok();
                                // Then emit event for frontend to show confirmation
                                window.emit("tray:quit-requested", ()).ok();
                            }
                            _ => {}
                        }
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Left click on tray icon = restore window
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            window.show().ok();
                            window.unminimize().ok();
                            window.set_focus().ok();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
