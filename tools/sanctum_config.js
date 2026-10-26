#!/usr/bin/env node

import { defaultSettingsStore } from "../core/infra/storage/settings_store.ts";
import { SETTINGS_SCHEMA } from "../core/domain/settings_schema.ts";

const args = process.argv.slice(2);
const cmd = args[0];

function printHelp() {
  console.log(`Sanctum Configuration CLI
Usage:
  sanctum config get <key>
  sanctum config set <key> <value>
  sanctum config list
  sanctum config reset <key>
  sanctum config export
  sanctum config import <json-string>
`);
}

if (!cmd || cmd === "--help" || cmd === "-h") {
  printHelp();
  process.exit(0);
}

try {
  switch (cmd) {
    case "get": {
      const key = args[1];
      if (!key) {
        console.error("Error: Key required");
        process.exit(1);
      }
      const val = defaultSettingsStore.get(key);
      console.log(val);
      break;
    }
    case "set": {
      const key = args[1];
      const rawVal = args[2];
      if (!key || rawVal === undefined) {
        console.error("Error: Key and value required");
        process.exit(1);
      }
      let parsedVal = rawVal;
      if (rawVal === "true") parsedVal = true;
      else if (rawVal === "false") parsedVal = false;
      else if (!isNaN(Number(rawVal)) && rawVal.trim() !== "") parsedVal = Number(rawVal);
      defaultSettingsStore.set(key, parsedVal);
      console.log(`OK: ${key} = ${parsedVal}`);
      break;
    }
    case "list": {
      const items = defaultSettingsStore.list();
      for (const item of items) {
        const mod = item.isModified ? " [modified]" : "";
        console.log(`${item.key} = ${JSON.stringify(item.value)}${mod} (${item.definition.type})`);
      }
      break;
    }
    case "reset": {
      const key = args[1];
      if (key) {
        defaultSettingsStore.reset(key);
        console.log(`OK: ${key} reset to default`);
      } else {
        defaultSettingsStore.resetAll();
        console.log("OK: All settings reset to defaults");
      }
      break;
    }
    case "export": {
      console.log(defaultSettingsStore.export());
      break;
    }
    default:
      console.error(`Unknown command: ${cmd}`);
      printHelp();
      process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
