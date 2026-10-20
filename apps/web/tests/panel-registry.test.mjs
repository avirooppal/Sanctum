import test from 'node:test';
import assert from 'node:assert/strict';
import { PanelRegistry } from '../build/tests/panels/registry.js';

test('PanelRegistry registers, retrieves, and rejects duplicates', () => {
  const reg = new PanelRegistry();
  const dummyPanel = {
    id: 'test-panel',
    title: 'Test Panel',
    icon: '🧪',
    allowedSlots: ['center'],
    requiredCapabilities: ['test_cap'],
    defaultVisibility: true,
    component: () => null,
  };

  reg.register(dummyPanel);
  assert.equal(reg.get('test-panel'), dummyPanel);
  assert.equal(reg.all().length, 1);

  // Duplicate registration must throw
  assert.throws(() => reg.register(dummyPanel), /already registered/);

  // Panel with empty allowedSlots must throw
  assert.throws(
    () =>
      reg.register({
        id: 'invalid-panel',
        title: 'Invalid',
        icon: '❌',
        allowedSlots: [],
        requiredCapabilities: [],
        defaultVisibility: true,
        component: () => null,
      }),
    /must declare at least one allowed slot/
  );
});

test('PanelRegistry filters panels by available capabilities', () => {
  const reg = new PanelRegistry();
  reg.register({
    id: 'chat',
    title: 'Chat',
    icon: '💬',
    allowedSlots: ['center'],
    requiredCapabilities: ['chat'],
    defaultVisibility: true,
    component: () => null,
  });
  reg.register({
    id: 'vision',
    title: 'Vision Reasoning',
    icon: '👁️',
    allowedSlots: ['center'],
    requiredCapabilities: ['chat', 'vlm'],
    defaultVisibility: false,
    component: () => null,
  });

  // When only 'chat' is available, vision must be excluded
  const chatOnly = reg.filterByCapabilities(['chat']);
  assert.equal(chatOnly.length, 1);
  assert.equal(chatOnly[0].id, 'chat');

  // When both 'chat' and 'vlm' are available, both must be included
  const both = reg.filterByCapabilities(['chat', 'vlm']);
  assert.equal(both.length, 2);
});

test('PanelRegistry queries panels by layout slot and capabilities', () => {
  const reg = new PanelRegistry();
  reg.register({
    id: 'sidebar-panel',
    title: 'Sidebar',
    icon: '📑',
    allowedSlots: ['left'],
    requiredCapabilities: ['history'],
    defaultVisibility: true,
    component: () => null,
  });
  reg.register({
    id: 'main-chat',
    title: 'Chat',
    icon: '💬',
    allowedSlots: ['center'],
    requiredCapabilities: ['chat'],
    defaultVisibility: true,
    component: () => null,
  });

  const leftPanels = reg.getSlotPanels('left', ['history', 'chat']);
  assert.equal(leftPanels.length, 1);
  assert.equal(leftPanels[0].id, 'sidebar-panel');

  const centerPanels = reg.getSlotPanels('center', ['history', 'chat']);
  assert.equal(centerPanels.length, 1);
  assert.equal(centerPanels[0].id, 'main-chat');

  // If history capability is missing, left slot panel is hidden
  const leftWithoutCap = reg.getSlotPanels('left', ['chat']);
  assert.equal(leftWithoutCap.length, 0);
});

test('PanelRegistry allows dynamic registration and unregistration of third-party dummy panels', () => {
  const reg = new PanelRegistry();
  const dummy = {
    id: 'custom-plugin',
    title: 'Custom Plugin',
    icon: '🔌',
    allowedSlots: ['right', 'bottom'],
    requiredCapabilities: ['plugins'],
    defaultVisibility: false,
    component: () => null,
  };

  reg.register(dummy);
  assert.equal(reg.getSlotPanels('right', ['plugins']).length, 1);
  assert.equal(reg.getSlotPanels('bottom', ['plugins']).length, 1);

  const removed = reg.unregister('custom-plugin');
  assert.equal(removed, true);
  assert.equal(reg.get('custom-plugin'), undefined);
});
