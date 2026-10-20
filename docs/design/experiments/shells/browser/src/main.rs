use std::io::{Read, Write};
use tao::event::Event;
use tao::event_loop::{ControlFlow, EventLoopBuilder};
use tray_icon::menu::{Menu, MenuEvent, MenuItem};
use tray_icon::{Icon, TrayIconBuilder};

fn main() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("loopback");
    let address = listener.local_addr().unwrap();
    std::thread::spawn(move || {
        for connection in listener.incoming() {
            let mut stream = connection.unwrap();
            stream
                .set_read_timeout(Some(std::time::Duration::from_secs(2)))
                .unwrap();
            let mut input = [0; 4096];
            let Ok(count) = stream.read(&mut input) else {
                continue;
            };
            let ready = input[..count].starts_with(b"GET /ready ");
            let body = if ready {
                "ready"
            } else {
                include_str!("../../hello-browser.html")
            };
            let reply = format!("HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body);
            let _ = stream.write_all(reply.as_bytes());
            if ready {
                println!("SANCTUM_LAB_READY");
            }
        }
    });
    let events = EventLoopBuilder::<()>::with_user_event().build();
    let proxy = events.create_proxy();
    MenuEvent::set_event_handler(Some(move |_| {
        let _ = proxy.send_event(());
    }));
    let menu = Menu::new();
    menu.append(&MenuItem::new("Quit experiment", true, None))
        .unwrap();
    let icon = Icon::from_rgba([44, 90, 74, 255].repeat(16 * 16), 16, 16).unwrap();
    let _tray = TrayIconBuilder::new()
        .with_icon(icon)
        .with_tooltip("Sanctum shell experiment")
        .with_menu(Box::new(menu))
        .build()
        .unwrap();
    let url = format!("http://{address}/");
    #[cfg(target_os = "windows")]
    let launch = if let Ok(program) = std::env::var("SANCTUM_LAB_BROWSER_PROGRAM") {
        // Measurement-only isolated profile in the installed Chromium-family browser.
        // It keeps unrelated user tabs out of memory accounting and cleanup.
        let profile =
            std::env::temp_dir().join(format!("sanctum-shell-experiment-{}", std::process::id()));
        std::process::Command::new(program)
            .arg("--no-first-run")
            .arg("--no-default-browser-check")
            .arg(format!("--user-data-dir={}", profile.display()))
            .arg(format!("--app={url}"))
            .spawn()
    } else {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &url])
            .spawn()
    };
    #[cfg(target_os = "linux")]
    let launch = std::process::Command::new("xdg-open").arg(&url).spawn();
    #[cfg(target_os = "macos")]
    let launch = std::process::Command::new("open").arg(&url).spawn();
    println!("SANCTUM_LAB_BROWSER_LAUNCH {:?}", launch.map(|c| c.id()));
    events.run(move |event, _, control| {
        *control = ControlFlow::Wait;
        if let Event::UserEvent(()) = event {
            *control = ControlFlow::Exit;
        }
    });
}
