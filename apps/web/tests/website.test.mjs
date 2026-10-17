import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export function validatePlatformStatus(html, checklistMd) {
  // Extract unverified and partial platforms from checklist
  const unverifiedPatterns = [];
  const matrixMatch = checklistMd.match(/## Support matrix[\s\S]*?(?=\n## |\n#[^#]|$)/);
  if (!matrixMatch) {
    throw new Error('Support matrix section not found in checklist');
  }

  const lines = matrixMatch[0].split('\n');
  for (const line of lines) {
    if (line.includes('UNVERIFIED') || line.includes('Not supported yet')) {
      const parts = line.split('|').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        unverifiedPatterns.push(parts[0]);
      }
    }
  }

  // Check each unverified platform against website HTML
  for (const pattern of unverifiedPatterns) {
    const isWin = pattern.includes('Windows') && pattern.includes('desktop');
    const isMac = pattern.includes('macOS') || pattern.includes('Apple Silicon');
    const isVoice = pattern.includes('voice') || pattern.includes('audio');
    const isGpu = pattern.includes('NVIDIA') || pattern.includes('vLLM');

    // Forbidden to claim any of these unverified targets as verified in the HTML
    if (isWin && /<td><strong>Native Windows Desktop(?:(?!<\/tr>)[\s\S])*?<span class="badge-verified">Verified/i.test(html)) {
      throw new Error(`Contradiction: Native Windows is UNVERIFIED in checklist but claimed as verified in website HTML`);
    }
    if (isMac && /<td><strong>Native macOS Desktop(?:(?!<\/tr>)[\s\S])*?<span class="badge-verified">Verified/i.test(html)) {
      throw new Error(`Contradiction: macOS is UNVERIFIED in checklist but claimed as verified in website HTML`);
    }
    if (isVoice && /<td><strong>T1 Hardware Voice(?:(?!<\/tr>)[\s\S])*?<span class="badge-verified">Verified/i.test(html)) {
      throw new Error(`Contradiction: Voice is UNVERIFIED in checklist but claimed as verified in website HTML`);
    }
    if (isGpu && /<td><strong>NVIDIA GPU(?:(?!<\/tr>)[\s\S])*?<span class="badge-verified">Verified/i.test(html)) {
      throw new Error(`Contradiction: GPU is UNVERIFIED in checklist but claimed as verified in website HTML`);
    }
  }

  // Ensure website explicitly marks Native Windows, macOS, Voice, GPU as UNVERIFIED or not available
  assert.match(html, /Native Windows Desktop[\s\S]*?UNVERIFIED/);
  assert.match(html, /Native macOS Desktop[\s\S]*?UNVERIFIED/);
  assert.match(html, /T1 Hardware Voice[\s\S]*?UNVERIFIED/);
  assert.match(html, /NVIDIA GPU[\s\S]*?UNVERIFIED/);
  assert.match(html, /Air-gapped LAN[\s\S]*?Partial/);

  return true;
}

test('public website is offline, branded Sanctum, with honest setup links', () => {
  const html = readFileSync(new URL('../website.html', import.meta.url), 'utf8');
  assert.match(html, /<title>Sanctum/);
  assert.match(html, /Native Windows.*not yet available/s);
  assert.match(html, /Linux packages.*not yet available/s);
  assert.match(html, /href="\/"/);
  assert.match(html, /<details>/);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    assert.match(match[1], /^(?:\/(?!\/)|#)/, 'every asset and navigation is local');
  }
  assert.doesNotMatch(html, /<script|<iframe|<img|<form|onclick=|Hermes|Nous Portal/);
});

test('docs site is offline, branded Sanctum, with local navigation and zero scripts/images', () => {
  const html = readFileSync(new URL('../docs.html', import.meta.url), 'utf8');
  assert.match(html, /<title>Sanctum Documentation/);
  assert.match(html, /href="\/website\.html"/);
  assert.match(html, /href="\/"/);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    assert.match(match[1], /^(?:\/(?!\/)|#)/, 'every docs asset and link is local');
  }
  assert.doesNotMatch(html, /<script|<iframe|<img|<form|onclick=|Hermes|Nous Portal/);
});

test('platform-status section reads only verified artifacts and fails if it disagrees with RELEASE_CHECKLIST.md', () => {
  const html = readFileSync(new URL('../website.html', import.meta.url), 'utf8');
  const checklist = readFileSync(new URL('../../../docs/RELEASE_CHECKLIST.md', import.meta.url), 'utf8');

  // Must pass with real checklist and real html
  assert.equal(validatePlatformStatus(html, checklist), true);

  // Must fail if an unverified platform is falsely claimed as verified
  const falseWinHtml = html.replace(
    '<td><span class="badge-unverified">UNVERIFIED</span></td>\n                <td>Native Windows runtime',
    '<td><span class="badge-verified">Verified (Release)</span></td>\n                <td>Native Windows runtime'
  );
  assert.throws(() => validatePlatformStatus(falseWinHtml, checklist), /Contradiction: Native Windows is UNVERIFIED/);

  const falseMacHtml = html.replace(
    '<td><span class="badge-unverified">UNVERIFIED</span></td>\n                <td>Native containment, Apple Silicon',
    '<td><span class="badge-verified">Verified (Release)</span></td>\n                <td>Native containment, Apple Silicon'
  );
  assert.throws(() => validatePlatformStatus(falseMacHtml, checklist), /Contradiction: macOS is UNVERIFIED/);
});


test('platform comparison is independent of checklist row order and later rows', () => {
  const html = readFileSync(new URL('../website.html', import.meta.url), 'utf8');
  const matrix = '## Support matrix\n| Native Windows desktop | UNVERIFIED |\n| Native macOS desktop | UNVERIFIED |\n';
  assert.equal(validatePlatformStatus(html, matrix), true);
  const laterVerified = html + '<table><tr><td><span class="badge-verified">Verified local source tests</span></td></tr></table>';
  assert.equal(validatePlatformStatus(laterVerified, matrix), true);
});
