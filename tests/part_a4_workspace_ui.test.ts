import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

describe("Part A4: Workspace switcher UI, wizard, shortcuts, title/tray & host UI state", () => {
  test("WorkspaceSwitcher, LeftSidebar, SearchDialog, SettingsShortcuts, and DesktopHost wire all required controls", () => {
    const switcher = fs.readFileSync(path.join(ROOT, "src/components/jan/WorkspaceSwitcher.tsx"), "utf-8");
    const sidebar = fs.readFileSync(path.join(ROOT, "src/components/jan/LeftSidebar.tsx"), "utf-8");
    const shell = fs.readFileSync(path.join(ROOT, "src/components/jan/JanAppShell.tsx"), "utf-8");
    const search = fs.readFileSync(path.join(ROOT, "src/components/jan/SearchDialog.tsx"), "utf-8");
    const shortcuts = fs.readFileSync(path.join(ROOT, "src/components/jan/sections/SettingsShortcuts.tsx"), "utf-8");
    const store = fs.readFileSync(path.join(ROOT, "src/store/useAppStore.ts"), "utf-8");
    const slice = fs.readFileSync(path.join(ROOT, "src/store/slices/workspaceSlice.ts"), "utf-8");
    const host = fs.readFileSync(path.join(ROOT, "tools/native/DesktopHost.cs"), "utf-8");

    assert.match(switcher, /workspace-switcher-trigger/);
    assert.match(switcher, /workspace-missing-root-banner/);
    assert.match(switcher, /Folder missing: Locate \/ Remove/);
    assert.match(switcher, /global-attention-inbox/);
    assert.match(switcher, /Open Existing Workspace/);
    assert.match(switcher, /Copy settings from \(settings only, never data\)/);
    assert.match(sidebar, /<WorkspaceSwitcher/);
    assert.match(shell, /e\.shiftKey && key === "w"/);
    assert.match(search, /Workspaces \(Ctrl\+Shift\+W\)/);
    assert.match(shortcuts, /Switch Workspace/);
    assert.match(shortcuts, /shortcuts\.switchWorkspace/);
    // Workspace view state must NOT be persisted in localStorage partialize
    assert.doesNotMatch(store, /activeWorkspaceId:\s*state\.activeWorkspaceId/);
    assert.match(slice, /\/v1\/workspaces\/\$\{encodeURIComponent\(workspaceId\)\}\/ui-state/);
    assert.match(host, /setWorkspaceTitle/);
    assert.match(host, /_mainTrayIcon\.Text/);
  });
});
