import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DashboardPanel } from '../build/tests/DashboardPanel.js';

test('DashboardPanel renders daemon health and dispatch lanes without throwing', () => {
  const html = renderToStaticMarkup(React.createElement(DashboardPanel, { token: 'mock-token' }));
  assert(html.includes('Local Platform Status'));
  assert(html.includes('Engine Dispatch Queues'));
  assert(html.includes('Daemon Health'));
  assert(html.includes('Cloud Policy'));
  assert(html.includes('Voice (Interactive)'));
  assert(html.includes('Chat (Interactive)'));
  assert(html.includes('Zero remote tracking, analytics, telemetry, or external network calls'));
});
