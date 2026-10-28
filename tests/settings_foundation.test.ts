import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { SETTINGS_SCHEMA, SETTINGS_SCHEMA_MAP } from "../core/domain/settings_schema.ts";
import { SettingsStore } from "../core/infra/storage/settings_store.ts";

test("Settings Foundation (S0): Unified Schema, Storage, Precedence, and CLI", async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sanctum-settings-test-"));
  const tmpConfig = path.join(tmpDir, "settings.json");
  const tmpLedger = path.join(tmpDir, "download_ledger.json");

  await t.test("schema definition completeness", () => {
    assert.ok(SETTINGS_SCHEMA.length >= 15, "Schema must define core settings");
    for (const def of SETTINGS_SCHEMA) {
      assert.ok(def.key, "Key must exist");
      assert.ok(def.section, `Section must exist for ${def.key}`);
      assert.ok(def.label, `Label must exist for ${def.key}`);
      assert.ok(def.type, `Type must exist for ${def.key}`);
      assert.notEqual(def.default, undefined, `Default must exist for ${def.key}`);
      assert.ok(def.scope, `Scope must exist for ${def.key}`);
      assert.ok(def.risk, `Risk must exist for ${def.key}`);
      assert.equal(typeof def.restartRequired, "boolean", `restartRequired must be boolean for ${def.key}`);
    }
  });

  await t.test("persistence, get, and set with validation", () => {
    const store = new SettingsStore(tmpConfig);

    // Initial default
    const lang = store.get("general.language");
    assert.equal(lang, "en");

    // Valid update
    store.set("general.language", "fr");
    assert.equal(store.get("general.language"), "fr");

    // Read file directly from disk to confirm atomic persistence
    const onDisk = JSON.parse(fs.readFileSync(tmpConfig, "utf-8"));
    assert.equal(onDisk["general.language"], "fr");

    // Invalid update rejected with descriptive message
    assert.throws(
      () => store.set("general.language", "klingon"),
      /must be one of/
    );

    // Number min/max validation
    assert.throws(
      () => store.set("hardware.cpuThreads", 999),
      /must be at most 64/
    );
    assert.throws(
      () => store.set("hardware.cpuThreads", 0),
      /must be at least 1/
    );

    // Valid number update
    store.set("hardware.cpuThreads", 8);
    assert.equal(store.get("hardware.cpuThreads"), 8);
  });

  await t.test("reset restores default and removes key from config file", () => {
    const store = new SettingsStore(tmpConfig);
    store.set("general.language", "de");
    assert.equal(store.get("general.language"), "de");

    store.reset("general.language");
    assert.equal(store.get("general.language"), "en");

    const onDisk = JSON.parse(fs.readFileSync(tmpConfig, "utf-8"));
    assert.equal(onDisk["general.language"], undefined);
  });

  await t.test("precedence: env var overrides config file", () => {
    const store = new SettingsStore(tmpConfig);
    store.set("general.language", "es");

    // Fresh instance reads config file from disk; env var takes precedence
    const storeFromDisk = new SettingsStore(tmpConfig);
    assert.equal(storeFromDisk.get("general.language"), "es");

    process.env["SANCTUM_GENERAL_LANGUAGE"] = "ja";
    try {
      assert.equal(storeFromDisk.get("general.language"), "ja");
    } finally {
      delete process.env["SANCTUM_GENERAL_LANGUAGE"];
    }

    // Falls back to config file after env var removed
    assert.equal(storeFromDisk.get("general.language"), "es");
  });

  await t.test("hostile or corrupt JSON falls back safely", () => {
    fs.writeFileSync(tmpConfig, "{ this is not valid JSON !!!", "utf-8");
    const store = new SettingsStore(tmpConfig);
    // Should safely fallback to default without crashing
    const lang = store.get("general.language");
    assert.equal(lang, "en");
  });

  await t.test("network-affecting settings write to download/privacy ledger", () => {
    const store = new SettingsStore(tmpConfig);
    store.set("general.autoUpdateCheck", true);

    assert.ok(fs.existsSync(tmpLedger), "Ledger file must be created on network setting change");
    const ledger = JSON.parse(fs.readFileSync(tmpLedger, "utf-8"));
    const entry = ledger.find((e: any) => e.key === "general.autoUpdateCheck");
    assert.ok(entry, "Setting change must be logged in ledger");
    assert.equal(entry.value, true);
  });

  await t.test("comprehensive section keys coverage across all schema settings", () => {
    const store = new SettingsStore(tmpConfig);

    // Assistants
    store.set("assistants.defaultModel", "llama-3-8b");
    store.set("assistants.systemPrompt", "Custom instructions");
    store.set("assistants.temperature", 0.5);
    store.set("assistants.topP", 0.9);
    store.set("assistants.maxTokens", 1024);
    assert.equal(store.get("assistants.temperature"), 0.5);

    // Attachments
    store.set("attachments.enable", true);
    store.set("attachments.maxFileSizeMB", 50);
    store.set("attachments.chunkSize", 1000);
    store.set("attachments.chunkOverlap", 200);
    store.set("attachments.topK", 8);
    assert.equal(store.get("attachments.maxFileSizeMB"), 50);

    // Local API
    store.set("localApi.enable", true);
    store.set("localApi.host", "127.0.0.1");
    store.set("localApi.port", 8080);
    store.set("localApi.apiKeyRequired", true);
    store.set("localApi.corsEnabled", true);
    assert.equal(store.get("localApi.port"), 8080);

    // HTTPS Proxy
    store.set("httpsProxy.enable", false);
    store.set("httpsProxy.url", "http://proxy.local:8080");
    store.set("httpsProxy.bypass", "localhost,127.0.0.1");
    assert.equal(store.get("httpsProxy.url"), "http://proxy.local:8080");

    // Web Search
    store.set("webSearch.enable", false);
    store.set("webSearch.provider", "duckduckgo");
    store.set("webSearch.endpoint", "http://127.0.0.1:8888");
    assert.equal(store.get("webSearch.provider"), "duckduckgo");

    // Shortcuts
    store.set("shortcuts.newChat", "Ctrl+N");
    store.set("shortcuts.newProject", "Ctrl+P");
    store.set("shortcuts.search", "Ctrl+K");
    assert.equal(store.get("shortcuts.newChat"), "Ctrl+N");

    // Privacy
    store.set("privacy.diagnosticOptIn", false);
    store.set("privacy.strictConsentPrompt", true);
    assert.equal(store.get("privacy.strictConsentPrompt"), true);

    // Developer & Observability
    store.set("developer.inspectRequests", true);
    store.set("developer.traceContentCapture", false);
    store.set("developer.traceRetention", 500);
    assert.equal(store.get("developer.inspectRequests"), true);
    assert.equal(store.get("developer.traceRetention"), 500);
  });

  await t.test("CLI command execution: get, set, list, reset", () => {
    const cliPath = path.resolve(process.cwd(), "tools/sanctum_config.js");
    
    // Set via CLI
    const setOut = execSync(`node ${cliPath} set appearance.fontSize small`, { encoding: "utf-8" });
    assert.match(setOut, /OK: appearance\.fontSize = small/);

    // Get via CLI
    const getOut = execSync(`node ${cliPath} get appearance.fontSize`, { encoding: "utf-8" });
    assert.match(getOut, /small/);

    // List via CLI
    const listOut = execSync(`node ${cliPath} list`, { encoding: "utf-8" });
    assert.match(listOut, /appearance\.fontSize/);

    // Reset via CLI
    const resetOut = execSync(`node ${cliPath} reset appearance.fontSize`, { encoding: "utf-8" });
    assert.match(resetOut, /reset to default/);
  });

  // Cleanup
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}
});
