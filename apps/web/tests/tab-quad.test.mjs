import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { TabRail } from '../build/tests/ui/TabRail.js';
import { QuadView } from '../build/tests/ui/QuadView.js';

test('TabRail renders accessible tablist, active tab, and close button', () => {
  const tabs = [
    { id: 'tab1', title: 'First Session' },
    { id: 'tab2', title: 'Second Session' },
  ];

  const html = renderToString(
    React.createElement(TabRail, {
      tabs,
      activeTabId: 'tab1',
      onSelectTab: () => {},
      onCloseTab: () => {},
      onNewTab: () => {},
    })
  );

  assert.ok(html.includes('role="tablist"'), 'Must render role="tablist"');
  assert.ok(html.includes('aria-selected="true"'), 'Active tab must have aria-selected="true"');
  assert.ok(html.includes('First Session'));
  assert.ok(html.includes('Second Session'));
  assert.ok(html.includes('Close First Session'));
  assert.ok(html.includes('+'));
});

test('QuadView renders four independent panes and clear waiting state under admission limits', () => {
  const panes = [
    {
      id: 'p1',
      title: 'Pane 1',
      messages: [{ role: 'user', content: 'hello from 1' }],
      status: 'Ready',
    },
    {
      id: 'p2',
      title: 'Pane 2',
      messages: [],
      status: 'Waiting',
      waitingState: {
        reason: 'Admission limit reached: Waiting for lane permit...',
        countdown: 5,
      },
    },
    {
      id: 'p3',
      title: 'Pane 3',
      messages: [],
      status: '',
    },
    {
      id: 'p4',
      title: 'Pane 4',
      messages: [],
      status: '',
    },
  ];

  const html = renderToString(
    React.createElement(QuadView, {
      panes,
      onSendMessage: () => {},
      activePaneIndex: 0,
    })
  );

  assert.ok(html.includes('Pane 1'));
  assert.ok(html.includes('hello from 1'));
  assert.ok(html.includes('Pane 2'));
  assert.ok(html.includes('role="status"'), 'Waiting state must have accessible role="status"');
  assert.ok(html.includes('Admission limit reached'), 'Must display admission limit reason');
  assert.ok(html.includes('5s'), 'Must display countdown seconds');
  assert.ok(html.includes('disabled=""'), 'Input must be disabled while waiting under admission limits');
});
