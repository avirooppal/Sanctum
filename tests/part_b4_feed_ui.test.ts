import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

describe("Part B4: Feed Pane UI tab, slot, airspace, consent screen, status chip & Ctrl+Shift+F", () => {
  test("FeedPaneTab, ArtifactViewerPanel, and JanAppShell wire all required Feed UI controls", () => {
    const feed = fs.readFileSync(path.join(ROOT, "src/components/viewer/FeedPaneTab.tsx"), "utf-8");
    const panel = fs.readFileSync(path.join(ROOT, "src/components/viewer/ArtifactViewerPanel.tsx"), "utf-8");
    const shell = fs.readFileSync(path.join(ROOT, "src/components/jan/JanAppShell.tsx"), "utf-8");
    const chat = fs.readFileSync(path.join(ROOT, "src/components/screens/ChatScreen.tsx"), "utf-8");
    const split = fs.readFileSync(path.join(ROOT, "src/components/chat/SplitChatPane.tsx"), "utf-8");

    assert.match(feed, /data-testid="feed-consent-screen"/);
    assert.match(feed, /Instagram\/Meta/);
    assert.match(feed, /The AI agent cannot see, read, screenshot, or control this pane/);
    assert.match(feed, /data-testid="feed-offline-notice"/);
    assert.match(feed, /data-testid="feed-slot"/);
    assert.match(feed, /new ResizeObserver/);
    assert.match(feed, /winWidth:\s*window\.innerWidth/);
    assert.match(feed, /new MutationObserver/);
    assert.match(feed, /data-testid="feed-paused-card"/);
    assert.match(feed, /Sanctum needs you:/);
    assert.match(feed, /InPrivate mode/);
    assert.match(panel, /data-testid="right-panel-feed-tab"/);
    assert.match(panel, /Doomscrolling/);
    assert.match(panel, /<FeedPaneTab \/>/);
    assert.match(shell, /sanctum:toggle-feed-pane/);
    assert.match(chat, /syntax:\s*"\/doomscroll"/);
    assert.match(split, /syntax:\s*"\/doomscroll"/);
  });
});
