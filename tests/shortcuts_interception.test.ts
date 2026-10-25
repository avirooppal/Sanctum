import test from "node:test";
import assert from "node:assert/strict";

interface MockKeyboardEventInit {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

class MockKeyboardEvent {
  public key: string;
  public ctrlKey: boolean;
  public metaKey: boolean;
  public defaultPrevented = false;
  public propagationStopped = false;

  constructor(init: MockKeyboardEventInit) {
    this.key = init.key;
    this.ctrlKey = !!init.ctrlKey;
    this.metaKey = !!init.metaKey;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.propagationStopped = true;
  }
}

function createShortcutDispatcher(actions: {
  openProject: () => void;
  openSearch: () => void;
  newChat: () => void;
  toggleSidebar: () => void;
  openSettings: () => void;
}) {
  return (e: MockKeyboardEvent) => {
    const hasModifier = e.ctrlKey || e.metaKey;
    if (!hasModifier) return;

    const k = e.key.toLowerCase();
    if (k === "p") {
      e.preventDefault();
      e.stopPropagation();
      actions.openProject();
    } else if (k === "k") {
      e.preventDefault();
      e.stopPropagation();
      actions.openSearch();
    } else if (k === "n") {
      e.preventDefault();
      e.stopPropagation();
      actions.newChat();
    } else if (k === "b") {
      e.preventDefault();
      e.stopPropagation();
      actions.toggleSidebar();
    } else if (k === ",") {
      e.preventDefault();
      e.stopPropagation();
      actions.openSettings();
    }
  };
}

test("Keyboard Shortcuts Interception: Browser Native Acceleration Prevention", async (t) => {
  let projectOpened = false;
  let searchOpened = false;
  let newChatTriggered = false;
  let sidebarToggled = false;
  let settingsOpened = false;

  const dispatch = createShortcutDispatcher({
    openProject: () => { projectOpened = true; },
    openSearch: () => { searchOpened = true; },
    newChat: () => { newChatTriggered = true; },
    toggleSidebar: () => { sidebarToggled = true; },
    openSettings: () => { settingsOpened = true; },
  });

  await t.test("Ctrl+P prevents native browser Print dialog and opens project dialog", () => {
    const event = new MockKeyboardEvent({ key: "p", ctrlKey: true });
    dispatch(event);

    assert.equal(event.defaultPrevented, true, "Ctrl+P must call preventDefault()");
    assert.equal(event.propagationStopped, true, "Ctrl+P must call stopPropagation()");
    assert.equal(projectOpened, true, "Ctrl+P must trigger project dialog opening");
  });

  await t.test("Ctrl+K prevents native browser address bar focus and opens search modal", () => {
    const event = new MockKeyboardEvent({ key: "k", ctrlKey: true });
    dispatch(event);

    assert.equal(event.defaultPrevented, true, "Ctrl+K must call preventDefault()");
    assert.equal(event.propagationStopped, true, "Ctrl+K must call stopPropagation()");
    assert.equal(searchOpened, true, "Ctrl+K must trigger search dialog opening");
  });

  await t.test("Ctrl+N prevents native browser New Window and triggers new chat", () => {
    const event = new MockKeyboardEvent({ key: "n", ctrlKey: true });
    dispatch(event);

    assert.equal(event.defaultPrevented, true, "Ctrl+N must call preventDefault()");
    assert.equal(event.propagationStopped, true, "Ctrl+N must call stopPropagation()");
    assert.equal(newChatTriggered, true, "Ctrl+N must trigger new chat creation");
  });

  await t.test("Ctrl+B toggles sidebar collapse", () => {
    const event = new MockKeyboardEvent({ key: "b", ctrlKey: true });
    dispatch(event);

    assert.equal(event.defaultPrevented, true, "Ctrl+B must call preventDefault()");
    assert.equal(sidebarToggled, true, "Ctrl+B must trigger sidebar toggle");
  });

  await t.test("Ctrl+, navigates to settings", () => {
    const event = new MockKeyboardEvent({ key: ",", ctrlKey: true });
    dispatch(event);

    assert.equal(event.defaultPrevented, true, "Ctrl+, must call preventDefault()");
    assert.equal(settingsOpened, true, "Ctrl+, must navigate to settings");
  });

  await t.test("regular typing without modifier does not intercept or preventDefault", () => {
    const normalP = new MockKeyboardEvent({ key: "p", ctrlKey: false });
    dispatch(normalP);
    assert.equal(normalP.defaultPrevented, false, "Regular 'p' must not be prevented");

    const normalK = new MockKeyboardEvent({ key: "k", ctrlKey: false });
    dispatch(normalK);
    assert.equal(normalK.defaultPrevented, false, "Regular 'k' must not be prevented");
  });
});
