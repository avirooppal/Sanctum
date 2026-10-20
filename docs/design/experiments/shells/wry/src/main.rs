use tao::{
    event::{Event, WindowEvent},
    event_loop::{ControlFlow, EventLoop},
    window::WindowBuilder,
};

fn main() {
    let events = EventLoop::new();
    let window = WindowBuilder::new()
        .with_title("Sanctum shell experiment: wry")
        .with_inner_size(tao::dpi::LogicalSize::new(640.0, 480.0))
        .build(&events)
        .expect("window");
    let builder = wry::WebViewBuilder::new()
        .with_html(include_str!("../../hello-wry.html"))
        .with_ipc_handler(|message| {
            if message.body() == "ready" {
                println!("SANCTUM_LAB_READY");
            }
        });
    #[cfg(target_os = "linux")]
    let _view = {
        use tao::platform::unix::WindowExtUnix;
        use wry::WebViewBuilderExtUnix;
        builder
            .build_gtk(window.default_vbox().expect("GTK container"))
            .expect("webview")
    };
    #[cfg(not(target_os = "linux"))]
    let _view = builder.build(&window).expect("webview");
    events.run(move |event, _, control| {
        *control = ControlFlow::Wait;
        if let Event::WindowEvent {
            event: WindowEvent::CloseRequested,
            ..
        } = event
        {
            *control = ControlFlow::Exit;
        }
    });
}
