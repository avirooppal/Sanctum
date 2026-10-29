// Run against an isolated desktop profile with --devtools and CDP port 19222.
// Requires real installed qwen3:1.7b and smollm2:135m models.
const { chromium, expect } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP(process.env.CDP_URL || 'http://127.0.0.1:19222');
  try {
    const page = browser.contexts()[0].pages()[0];
    const setup = page.getByRole('button', { name: 'Set up Sanctum', exact: true });
    if (await setup.count()) {
      await setup.click();
      await page.getByRole('button', { name: 'Start chatting', exact: true }).click({ timeout: 180000 });
    }
    const choose = async model => {
      await page.getByRole('combobox', { name: 'Select model' }).click();
      await page.getByRole('option', { name: model, exact: true }).click();
      await expect(page.getByRole('combobox', { name: 'Select model' })).toContainText(model);
    };
    const send = async prompt => {
      await page.locator('textarea').first().fill(prompt);
      await page.getByRole('button', { name: 'Send message', exact: true }).click();
      await page.waitForFunction(() => {
        const state = JSON.parse(localStorage.getItem('sanctum-platform-state')).state;
        return ['done', 'error'].includes(state.chatSessions.find(c => c.id === state.activeSessionId)?.messages.at(-1)?.requestStatus?.phase);
      }, undefined, { timeout: 180000 });
      const message = await page.evaluate(() => {
        const state = JSON.parse(localStorage.getItem('sanctum-platform-state')).state;
        return state.chatSessions.find(c => c.id === state.activeSessionId).messages.at(-1);
      });
      if (message.requestStatus.phase !== 'done') throw Error(JSON.stringify(message.requestStatus));
      return message;
    };
    await choose('qwen3:1.7b');
    const off = page.getByRole('button', { name: 'Tools off', exact: true });
    if (await off.count()) await off.click();
    const prefix = `verification-${Date.now()}`;
    const created = await send(`Create ${prefix}.txt containing exactly Hello Sanctum. Use create_file and then read_file to verify.`);
    if (!created.toolActivities?.some(a => a.name === 'create_file' && a.status === 'success')) throw Error('No successful creation');
    const edited = await send(`Read ${prefix}.txt, replace Hello Sanctum with Hello Developer, rename it to ${prefix}-done.txt, and read the renamed file.`);
    const read = edited.toolActivities?.findLast(a => a.name === 'read_file' && a.status === 'success');
    if (!read || JSON.parse(read.output).content !== 'Hello Developer') throw Error('Actual edited content did not match');
    const deleted = await send(`Delete ${prefix}-done.txt using delete_path.`);
    const deletion = deleted.toolActivities?.find(a => a.name === 'delete_path' && a.status === 'success');
    if (!deletion || !JSON.parse(deletion.output).recoverableAt) throw Error('No recoverable deletion');
    console.log('PASS real model create/read/edit/move/trash via desktop UI');
    await page.getByRole('button', { name: 'Tools on', exact: true }).click();
    await choose('smollm2:135m');
    await page.getByRole('button', { name: 'New Chat', exact: false }).first().click();
    const reply = await send('Say hello in one sentence.');
    if (reply.modelId !== 'smollm2:135m' || !reply.content) throw Error('Wrong answering model');
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Select model' })).toContainText('smollm2:135m');
    console.log('PASS second model actual answer and selection persistence');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
