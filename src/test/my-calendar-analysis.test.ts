import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

function loadApp() {
  localStorage.clear();
  const html = readFileSync(path.resolve(__dirname, '../../public/app.html'), 'utf8');
  const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1];
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!body || !script) throw new Error('Missing register document');
  document.body.innerHTML = body.replace(/<script>[\s\S]*?<\/script>/g, '');
  const app = window as any;
  app.eval(script);
  app.S.my = [
    { id: 'a1', d: '2026-11-02', a: 'Riunione', cat: '', h: 2, n: '' },
    { id: 'a2', d: '2026-11-05', a: 'Lezione', cat: '', h: 1.5, n: '' },
    { id: 'a3', d: '2026-11-05', a: 'Sci club', cat: 'Giovani', h: 3, n: '' },
    { id: 'a4', d: '2026-10-20', a: 'Sci club', cat: 'Allievi Race', h: 1, n: '' },
  ];
  return app;
}

it('splits personal calendar hours by activity type and category', () => {
  const app = loadApp();
  app.MYF = 'tutto';
  const out: string = app.myAna();
  expect(out).toContain('Ore per attività');
  expect(out).toContain('7,5 h totali');
  expect(out).toContain('4 attività');
  expect(out).toContain('3 giorni attivi');
  expect(out).toContain('2,5 h per giorno');
  for (const type of ['Riunione', 'Lezione', 'Sci club']) expect(out).toContain(type);
  expect(out).toContain('Ore per categoria');
  expect(out).toContain('Giovani');
  expect(out).toContain('Allievi Race');
  expect(out).toContain('Andamento mensile');
  expect(out).toContain('data-myf="mese"');
});

it('limits the analysis to the month being viewed', () => {
  const app = loadApp();
  app.MYF = 'mese';
  app.MYM = new Date(2026, 10, 1);
  const out: string = app.myAna();
  expect(out).toContain('6,5 h totali');
  expect(out).toContain('3 attività');
  expect(out).toContain('Giovani');
  expect(out).not.toContain('Allievi Race');
  expect(out).not.toContain('Andamento mensile');
});

it('shows an empty state before any personal activity is recorded', () => {
  const app = loadApp();
  app.S.my = [];
  const out: string = app.myAna();
  expect(out).toContain('Analisi ore');
  expect(out).toContain('Ancora nessuna attività segnata');
  expect(out).not.toContain('Ore per attività');
});
