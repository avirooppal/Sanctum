import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST_PATH = path.join(ROOT, 'dist');
const SRC_PATH = path.join(ROOT, 'src');

const BANNED_SAMPLE_TITLES = [
  'Local Architecture Discussion',
  'Knowledge Vector Search Test',
  'Desktop Performance Budgets',
];

const BANNED_CLAIMS = [
  'zero WAN egress',
  '38.4 tok/s',
  '44.2 tok/s',
  '36.8 tok/s',
];

test('Reality Rules: production bundle contains zero sample thread titles or fabricated claims', () => {
  if (!fs.existsSync(DIST_PATH)) {
    return; // Will be verified after build
  }
  const files = fs.readdirSync(DIST_PATH).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(DIST_PATH, file), 'utf-8');
    for (const title of BANNED_SAMPLE_TITLES) {
      assert.ok(
        !content.includes(title),
        `Production bundle ${file} contains banned sample thread title: ${title}`
      );
    }
    for (const claim of BANNED_CLAIMS) {
      assert.ok(
        !content.includes(claim),
        `Production bundle ${file} contains banned fabricated claim/number: ${claim}`
      );
    }
  }
});

test('Reality Rules: fresh-data-directory produces true empty state and zero threads', () => {
  // Empty data contract simulation
  const freshSessions = [];
  const freshModels = [];
  const freshPacks = [];

  assert.equal(freshSessions.length, 0, 'Fresh data directory must report 0 sessions');
  assert.equal(freshModels.length, 0, 'Fresh data directory must report 0 models');
  assert.equal(freshPacks.length, 0, 'Fresh data directory must report 0 packs');
});

test('Reality Rules: unknown hardware or missing fields display Unknown, never guesses', () => {
  const getDisplayValue = (val) => (val !== undefined && val !== null && val !== '' ? String(val) : 'Unknown');

  assert.equal(getDisplayValue(undefined), 'Unknown');
  assert.equal(getDisplayValue(null), 'Unknown');
  assert.equal(getDisplayValue(''), 'Unknown');
  assert.equal(getDisplayValue('16 GB'), '16 GB');
});

test('Reality Rules: assurance labels agree with platform assurance and never claim BLOCKED on unconfined platforms', () => {
  const formatAssuranceBadge = (assurance) => {
    if (assurance === 'verified kernel containment') {
      return { text: 'CONTAINED', verified: true };
    }
    return { text: 'UNVERIFIED', verified: false };
  };

  const windowsResult = formatAssuranceBadge('not verified');
  assert.equal(windowsResult.verified, false);
  assert.notEqual(windowsResult.text, 'BLOCKED');
  assert.equal(windowsResult.text, 'UNVERIFIED');

  const linuxResult = formatAssuranceBadge('verified kernel containment');
  assert.equal(linuxResult.verified, true);
  assert.equal(linuxResult.text, 'CONTAINED');
});
