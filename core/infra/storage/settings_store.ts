import fs from "node:fs";
import path from "node:path";
import { SETTINGS_SCHEMA, SETTINGS_SCHEMA_MAP, type SettingDefinition } from "../../domain/settings_schema.ts";

export interface SettingsChangeEvent {
  key: string;
  previousValue: any;
  newValue: any;
  timestamp: string;
  affectsNetworking: boolean;
}

export class SettingsStore {
  private configPath: string;
  private ledgerPath: string;
  private memoryOverrides: Map<string, any> = new Map();
  private listeners: ((event: SettingsChangeEvent) => void)[] = [];

  constructor(customPath?: string) {
    if (customPath) {
      this.configPath = customPath;
    } else {
      const appData = process.env.APPDATA || path.resolve(process.cwd(), ".sanctum");
      const dir = path.join(appData, "Sanctum");
      if (!fs.existsSync(dir)) {
        try { fs.mkdirSync(dir, { recursive: true }); } catch {}
      }
      this.configPath = path.join(dir, "settings.json");
    }
    this.ledgerPath = path.join(path.dirname(this.configPath), "download_ledger.json");
  }

  public onChange(listener: (event: SettingsChangeEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  private readConfigFile(): Record<string, any> {
    if (!fs.existsSync(this.configPath)) {
      return {};
    }
    try {
      const raw = fs.readFileSync(this.configPath, "utf-8");
      const parsed = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) {
        return {};
      }
      return this.migrate(parsed);
    } catch {
      // Hostile or corrupted config: safe fallback
      return {};
    }
  }

  private migrate(parsed: Record<string, any>): Record<string, any> {
    const version = parsed._version || 1;
    if (version < 2) {
      // Example migration: ensure version tag
      parsed._version = 2;
    }
    return parsed;
  }

  private writeConfigFile(data: Record<string, any>): void {
    data._version = 2;
    data._updatedAt = new Date().toISOString();
    const tempPath = this.configPath + ".tmp";
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tempPath, this.configPath);
  }

  private recordLedger(key: string, val: any): void {
    try {
      const entry = {
        timestamp: new Date().toISOString(),
        action: "setting_change",
        key,
        value: val,
        verified: true,
      };
      let entries: any[] = [];
      if (fs.existsSync(this.ledgerPath)) {
        try {
          entries = JSON.parse(fs.readFileSync(this.ledgerPath, "utf-8"));
        } catch {
          entries = [];
        }
      }
      entries.push(entry);
      fs.writeFileSync(this.ledgerPath, JSON.stringify(entries, null, 2), "utf-8");
    } catch {}
  }

  /**
   * Precedence: defaults < config file < environment < memory/UI override
   */
  public get<T = any>(key: string): T {
    const def = SETTINGS_SCHEMA_MAP.get(key);
    if (!def) {
      throw new Error(`Unknown setting key: "${key}"`);
    }

    // 1. UI / memory override
    if (this.memoryOverrides.has(key)) {
      return this.memoryOverrides.get(key);
    }

    // 2. Environment variable (e.g. SANCTUM_GENERAL_LANGUAGE)
    const envKey = "SANCTUM_" + key.toUpperCase().replace(/\./g, "_");
    if (process.env[envKey] !== undefined) {
      const rawEnv = process.env[envKey]!;
      if (def.type === "boolean") return (rawEnv === "true" || rawEnv === "1") as any;
      if (def.type === "number") return Number(rawEnv) as any;
      return rawEnv as any;
    }

    // 3. Config file on disk
    const fileData = this.readConfigFile();
    if (fileData[key] !== undefined) {
      return fileData[key];
    }

    // 4. Default from schema
    return def.default;
  }

  public set(key: string, val: any): void {
    const def = SETTINGS_SCHEMA_MAP.get(key);
    if (!def) {
      throw new Error(`Unknown setting key: "${key}"`);
    }

    this.validate(def, val);

    const prev = this.get(key);
    const fileData = this.readConfigFile();
    fileData[key] = val;
    this.writeConfigFile(fileData);
    this.memoryOverrides.set(key, val);

    if (def.affectsNetworking) {
      this.recordLedger(key, val);
    }

    const event: SettingsChangeEvent = {
      key,
      previousValue: prev,
      newValue: val,
      timestamp: new Date().toISOString(),
      affectsNetworking: !!def.affectsNetworking,
    };

    for (const listener of this.listeners) {
      try { listener(event); } catch {}
    }
  }

  public validate(def: SettingDefinition, val: any): void {
    if (def.type === "number") {
      if (typeof val !== "number" || isNaN(val)) {
        throw new Error(`Value for "${def.key}" must be a number`);
      }
      if (def.validation?.min !== undefined && val < def.validation.min) {
        throw new Error(`Value for "${def.key}" must be at least ${def.validation.min}`);
      }
      if (def.validation?.max !== undefined && val > def.validation.max) {
        throw new Error(`Value for "${def.key}" must be at most ${def.validation.max}`);
      }
    } else if (def.type === "boolean") {
      if (typeof val !== "boolean") {
        throw new Error(`Value for "${def.key}" must be a boolean`);
      }
    } else if (def.type === "select") {
      if (def.options && !def.options.some((o) => o.value === val)) {
        throw new Error(`Value for "${def.key}" must be one of [${def.options.map((o) => o.value).join(", ")}]`);
      }
    } else if (def.type === "string") {
      if (typeof val !== "string") {
        throw new Error(`Value for "${def.key}" must be a string`);
      }
      if (def.validation?.pattern) {
        const re = new RegExp(def.validation.pattern);
        if (!re.test(val)) {
          throw new Error(`Value for "${def.key}" does not match required format: ${def.validation.pattern}`);
        }
      }
    }
  }

  public reset(key: string): void {
    const def = SETTINGS_SCHEMA_MAP.get(key);
    if (!def) {
      throw new Error(`Unknown setting key: "${key}"`);
    }
    const fileData = this.readConfigFile();
    delete fileData[key];
    this.writeConfigFile(fileData);
    this.memoryOverrides.delete(key);
  }

  public resetAll(): void {
    this.memoryOverrides.clear();
    this.writeConfigFile({});
  }

  public list(): { key: string; value: any; definition: SettingDefinition; isModified: boolean }[] {
    const fileData = this.readConfigFile();
    return SETTINGS_SCHEMA.map((def) => {
      const val = this.get(def.key);
      const isModified = fileData[def.key] !== undefined || this.memoryOverrides.has(def.key);
      return {
        key: def.key,
        value: val,
        definition: def,
        isModified,
      };
    });
  }

  public export(): string {
    const fileData = this.readConfigFile();
    return JSON.stringify(fileData, null, 2);
  }

  public import(jsonStr: string): void {
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Invalid settings import format");
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (k.startsWith("_")) continue;
      const def = SETTINGS_SCHEMA_MAP.get(k);
      if (def) {
        this.validate(def, v);
      }
    }
    this.writeConfigFile(parsed);
    this.memoryOverrides.clear();
  }
}

export const defaultSettingsStore = new SettingsStore();
