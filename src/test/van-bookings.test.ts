import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, it, vi } from 'vitest';

let app: any;
beforeEach(() => {
  localStorage.clear();
  const html = readFileSync(path.resolve(__dirname, '../../public/app.html'), 'utf8');
  const body = /<body>([\s\S]*?)<\/body>/.exec(html)?.[1];
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!body || !script) throw new Error('Missing register document');
  document.body.innerHTML = body.replace(/<script>[\s\S]*?<\/script>/g, '');
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  app = window as any;
  app.eval(script);
  app.CREADY = false;
  app.S.vans = [];
  app.S.vanCoaches = [];
});

function booking(overrides = {}) {
  return { id: 'booking-1', van: 1, coach: 'Allenatore di prova', cats: ['Children Race', 'Giovani'], start: '2026-11-08T08:00', end: '2026-11-09T18:00', ...overrides };
}

it('accepts only pulmini 1, 2, 3, 4 and 5', () => {
  expect(app.VAN_NUMBERS).toEqual([1, 2, 3, 4, 5]);
  for (const van of [1, 2, 3, 4, 5]) expect(app.vanValidate(booking({ van }))).toBe('');
  expect(app.vanValidate(booking({ van: 6 }))).not.toBe('');
  expect(app.vanValidate(booking({ van: 0 }))).not.toBe('');
});

it('requires an identified coach and at least one existing category', () => {
  expect(app.vanValidate(booking({ coach: '' }))).not.toBe('');
  expect(app.vanValidate(booking({ cats: [] }))).not.toBe('');
  expect(app.vanValidate(booking())).toBe('');
});

it('requires return strictly after pickup', () => {
  expect(app.vanValidate(booking({ end: '2026-11-08T08:00' }))).not.toBe('');
  expect(app.vanValidate(booking({ end: '2026-11-08T07:00' }))).not.toBe('');
  expect(app.vanValidate(booking({ end: '2026-11-08T08:01' }))).toBe('');
});

it('shows a booking on every day until return, including cross-month trips', () => {
  const x = booking({ start: '2026-11-30T08:00', end: '2026-12-02T18:00' });
  for (const d of ['2026-11-30', '2026-12-01', '2026-12-02']) expect(app.vanDay(x, d)).toBe(true);
  expect(app.vanDay(x, '2026-11-29')).toBe(false);
  expect(app.vanDay(x, '2026-12-03')).toBe(false);
});

it('blocks overlapping trips for the same van but accepts different vans and consecutive bookings', () => {
  app.S.vans = [booking()];
  expect(app.vanValidate(booking({ id: 'second' }))).not.toBe('');
  expect(app.vanValidate(booking({ id: 'second', van: 2 }))).toBe('');
  expect(app.vanValidate(booking({ id: 'second', start: '2026-11-09T18:00', end: '2026-11-09T19:00' }))).toBe('');
  expect(app.vanValidate(booking())).toBe('');
});

it('saves, edits and packs all reservation details for backup', () => {
  app.VD = '2026-11-08';
  app.vanOpen();
  app.VF.cats = ['Children Race', 'Giovani'];
  (document.getElementById('van-number') as HTMLSelectElement).value = '5';
  (document.getElementById('van-coach') as HTMLInputElement).value = 'Allenatore di prova';
  (document.getElementById('van-start') as HTMLInputElement).value = '2026-11-08T08:00';
  (document.getElementById('van-end') as HTMLInputElement).value = '2026-11-09T18:00';
  expect(app.vanSave()).toBe(true);
  const saved = JSON.parse(localStorage.getItem('lt_v1') || '{}');
  expect(saved.vans[0]).toMatchObject(booking({ id: saved.vans[0].id, van: 5 }));
  expect(app.bkPack().data.vans).toEqual(saved.vans);
  app.vanOpen(saved.vans[0].id);
  (document.getElementById('van-number') as HTMLSelectElement).value = '3';
  expect(app.vanSave()).toBe(true);
  expect(app.S.vans).toHaveLength(1);
  expect(app.S.vans[0].van).toBe(3);
});

it('merges separate simultaneous bookings and coach names without dropping either device changes', () => {
  const left = { vans: [booking()], vanCoaches: [{ id: 'coach-1', name: 'Primo' }] };
  const right = { vans: [booking({ id: 'booking-2', van: 2 })], vanCoaches: [{ id: 'coach-2', name: 'Secondo' }] };
  const merged = app.merge3({}, left, right);
  expect(merged.vans.map((b: any) => b.id).sort()).toEqual(['booking-1', 'booking-2']);
  expect(merged.vanCoaches.map((b: any) => b.id).sort()).toEqual(['coach-1', 'coach-2']);
});