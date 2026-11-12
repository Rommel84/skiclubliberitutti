import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it, vi } from 'vitest';

function boot() {
  const html = readFileSync(path.resolve(__dirname, '../../public/app.html'), 'utf8');
  const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1];
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!body || !script) throw new Error('Missing register document');
  document.body.innerHTML = body.replace(/<script>[\s\S]*?<\/script>/g, '');
  (window as any).eval(script);
}

it('shows the login screen and hides the register without an account', () => {
  localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  boot();
  expect(document.getElementById('augate')).not.toBeNull();
  expect(document.getElementById('main')?.children.length ?? 0).toBe(0);
});

it('rejects a password other than the shared club password', () => {
  localStorage.clear();
  const f = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal('fetch', f);
  boot();
  (document.getElementById('auem') as HTMLInputElement).value = 'coach@example.com';
  (document.getElementById('aupw') as HTMLInputElement).value = 'sbagliata';
  (window as any).auLogin();
  expect(document.getElementById('augate')?.textContent).toContain('Password errata');
  expect(f).not.toHaveBeenCalled();
});
