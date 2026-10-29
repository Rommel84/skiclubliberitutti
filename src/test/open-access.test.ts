import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

it('lets a visitor without an account open and update the register', () => {
  localStorage.clear();
  const html = readFileSync(path.resolve(__dirname, '../../public/app.html'), 'utf8');
  const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1];
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!body || !script) throw new Error('Missing register document');
  document.body.innerHTML = body.replace(/<script>[\s\S]*?<\/script>/g, '');
  const app = window as any;
  app.LTCloud = { snapshot: () => { throw new Error('Login must not be called'); } };
  app.eval(script);
  expect(localStorage.getItem('lt_session')).toBeNull();
  expect(document.getElementById('main')?.children.length).toBeGreaterThan(0);
  app.gpOpen(app.S.ath[0].id);
  const input = document.getElementById('gpobj') as HTMLTextAreaElement | null;
  if (!input) throw new Error('Cannot edit athlete objectives');
  input.value = 'Migliorare la partenza';
  app.gpAddObj();
  const saved = JSON.parse(localStorage.getItem('lt_v1') || '{}');
  expect(saved.ath[0].obj).toContainEqual({ t: 'Migliorare la partenza', ok: 0 });
  delete app.LTCloud;
});