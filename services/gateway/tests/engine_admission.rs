#[cfg(target_os = "linux")]
#[test]
fn engine_permits_reserve_interactive_capacity_and_interoperate_with_python() {
    use sanctum_gateway::engine_admission::acquire;
    use std::process::Command;
    let root = std::env::temp_dir().join(format!("sanctum-admission-{}", std::process::id()));
    let background = acquire(&root, "port-9000", 2, true).unwrap();
    assert!(acquire(&root, "port-9000", 2, true).is_err());
    let interactive = acquire(&root, "port-9000", 2, false).unwrap();
    assert!(acquire(&root, "port-9000", 2, false).is_err());
    let script = "import sys; sys.path.insert(0, sys.argv[1]); from sanctum_knowledge.engine_admission import acquire; from pathlib import Path\ntry:\n with acquire(Path(sys.argv[2]), 'port-9000', 2, True): pass\nexcept TimeoutError: print('busy')\nelse: print('acquired')";
    let run = || {
        Command::new("python3")
            .arg("-c")
            .arg(script)
            .arg(concat!(env!("CARGO_MANIFEST_DIR"), "/../knowledge"))
            .arg(&root)
            .output()
            .unwrap()
    };
    let result = run();
    assert!(result.status.success(), "{:?}", result);
    assert_eq!(result.stdout, b"busy\n");
    drop(background);
    let result = run();
    assert!(result.status.success(), "{:?}", result);
    assert_eq!(result.stdout, b"acquired\n");
    drop(interactive);
    let single = acquire(&root, "asr", 1, false).unwrap();
    assert!(acquire(&root, "asr", 1, false).is_err());
    drop(single);
    assert!(acquire(&root, "asr", 1, false).is_ok());
    std::os::unix::fs::symlink(root.join("asr-0.lock"), root.join("tts-0.lock")).unwrap();
    assert!(acquire(&root, "tts", 1, false).is_err());

    assert!(acquire(&root, "../escape", 2, false).is_err());
    std::fs::remove_dir_all(root).unwrap();
}
