use sanctum_gateway::{
    packs::{PackManager, PackState},
    settings::{RiskLevel, SettingScope, SettingsEngine, SettingsRegistry},
};
use serde_json::json;
use std::env;

#[test]
fn test_settings_registry_validation_and_scopes() {
    let registry = SettingsRegistry::new();
    let def = registry
        .get_definition("ui.theme")
        .expect("ui.theme must exist");
    assert_eq!(def.scope, SettingScope::Global);
    assert_eq!(def.risk, RiskLevel::Low);
    assert_eq!(def.default_value, json!("dark"));

    assert!(registry.validate_value("ui.theme", &json!("light")).is_ok());
    assert!(registry
        .validate_value("ui.reduced_motion", &json!(true))
        .is_ok());
    assert!(registry
        .validate_value("ui.reduced_motion", &json!("not_bool"))
        .is_err());
    assert!(registry.validate_value("engine.threads", &json!(8)).is_ok());
    assert!(registry
        .validate_value("engine.threads", &json!("not_int"))
        .is_err());
}

#[test]
fn test_settings_engine_defaults_and_env_overrides() {
    let tmp = std::env::temp_dir().join(format!("sanctum-test-settings-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    let mut engine = SettingsEngine::new(&tmp);

    // Default value
    assert_eq!(engine.get("ui.theme"), Some(json!("dark")));

    // Explicit set
    assert!(engine.set("ui.theme", json!("light")).is_ok());
    assert_eq!(engine.get("ui.theme"), Some(json!("light")));

    // Persistence reload
    let reloaded = SettingsEngine::new(&tmp);
    assert_eq!(reloaded.get("ui.theme"), Some(json!("light")));

    // Env override takes precedence
    env::set_var("SANCTUM_CONFIG_UI_THEME", "system");
    assert_eq!(reloaded.get("ui.theme"), Some(json!("system")));
    env::remove_var("SANCTUM_CONFIG_UI_THEME");
    let _ = std::fs::remove_dir_all(&tmp);
}

#[test]
fn test_pack_manager_lifecycle_and_capability_report() {
    let tmp = std::env::temp_dir().join(format!("sanctum-test-packs-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&tmp);
    let mut mgr = PackManager::new(&tmp);

    let report = mgr.capability_report(8, 8192);
    assert!(report["capabilities"].is_array());
    assert!(report["packs"].is_array());

    // Knowledge starts installed
    let k = mgr.get("knowledge").expect("knowledge pack");
    assert_eq!(k.state, PackState::Installed);

    // Load pack
    let loaded = mgr.load("knowledge").expect("load knowledge");
    assert_eq!(loaded.state, PackState::Loaded);

    // Unload pack
    let unloaded = mgr.unload("knowledge").expect("unload knowledge");
    assert_eq!(unloaded.state, PackState::Installed);

    // Speech starts absent
    let s = mgr.get("speech").expect("speech pack");
    assert_eq!(s.state, PackState::Absent);
    assert!(mgr.load("speech").is_err(), "cannot load uninstalled pack");

    // Install speech
    let installed = mgr
        .install("speech", "builtin://speech")
        .expect("install speech");
    assert_eq!(installed.state, PackState::Installed);

    // Uninstall speech
    let uninstalled = mgr.uninstall("speech").expect("uninstall speech");
    assert_eq!(uninstalled.state, PackState::Absent);
    let _ = std::fs::remove_dir_all(&tmp);
}
