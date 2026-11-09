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
  return { id: 'booking-1', van: 1, coach: 'Gibi', cats: ['Children Race', 'Giovani'], start: '2026-11-08T08:00', end: '2026-11-09T18:00', ...overrides };
}

it('offers all twenty supplied drivers even without previously saved coaches', () => {
  expect(app.vanCoachNames()).toEqual(['Gibi', 'Lollo', 'Francy', 'Giulio', 'Cicco', 'Roberta', 'Tommy', 'Loca', 'Ceci', 'Giorgia', 'Gonty', 'Max', 'Monica', 'Pole', 'Loris', 'Fabio', 'Fede', 'Toio', 'Pux', 'Rommel']);
});

it('keeps Marco and Fra out of the driver list, even when previously saved', () => {
  app.S.vanCoaches = [{ id: 'm', name: 'Marco' }, { id: 'f', name: 'Fra' }, { id: 'g', name: 'Giulio' }];
  const names = app.vanCoachNames();
  expect(names).not.toContain('Marco');
  expect(names).not.toContain('Fra');
  expect(names).toContain('Giulio');
  expect(names).toContain('Francy');
  app.mig();
  expect(app.S.vanCoaches.map((c: any) => c.name)).toEqual(['Giulio']);
});

it('retains existing drivers while avoiding duplicate supplied names', () => {
  app.S.vanCoaches = [{ id: 'old', name: 'Vecchio allenatore' }, { id: 'gibi', name: 'Gibi' }];
  const names = app.vanCoachNames('Conducente precedente');
  expect(names.filter((n: string) => n === 'Gibi')).toHaveLength(1);
  expect(names).toContain('Vecchio allenatore');
  expect(names).toContain('Conducente precedente');
});

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
  (document.getElementById('van-coach') as HTMLSelectElement).value = 'Gibi';
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

it('names the five pulmini exactly as the coach listed them', () => {
  expect(app.VANS.map((v: any) => v.name)).toEqual(['Verde Ford', 'Verdone Talento', 'Giallo Pole', 'Blu Automatico', 'Arancione Giulio']);
  expect(app.vanName(3)).toBe('Pulmino 3 · Giallo Pole');
  expect(new Set(app.VANS.map((v: any) => v.c)).size).toBe(5);
});

it('greys the icon of an occupied pulmino and keeps the number in its own colour', () => {
  app.VD = '2026-11-08';
  app.S.vans = [booking({ van: 3 })];
  const wrap = document.createElement('div');
  wrap.innerHTML = app.vanView();
  const pills = [...wrap.querySelectorAll('.van-pill')] as HTMLElement[];
  const pill = (n: number) => pills.find((p) => p.querySelector('.vnum')?.textContent == String(n))!;
  expect(pill(3).querySelector('.vico')!.className).toContain('off');
  expect(pill(1).querySelector('.vico')!.className).not.toContain('off');
  expect(pill(3).getAttribute('style')).toContain('--vc:' + app.VANS[2].c);
  expect(pill(1).getAttribute('style')).toContain('--vc:' + app.VANS[0].c);
});

it('shows the pulmino name on the reservation card and in the form', () => {
  app.VD = '2026-11-08';
  app.S.vans = [booking({ van: 5 })];
  const wrap = document.createElement('div');
  wrap.innerHTML = app.vanView();
  expect(wrap.querySelector('.van-booking b')!.textContent).toBe('Pulmino 5 · Arancione Giulio');
  app.vanOpen('booking-1');
  const options = [...document.querySelectorAll('#van-number option')].map((o) => o.textContent);
  expect(options).toContain('Pulmino 5 · Arancione Giulio');
  app.vanClose();
});