import {
  toDatetimeLocalValue,
  tryFromDatetimeLocalValue,
} from '../notesApi';

describe('note date helpers', () => {
  it('round-trips a valid ISO timestamp to local datetime', () => {
    const iso = '2026-07-21T08:30:00.000Z';
    const local = toDatetimeLocalValue(iso);
    expect(local).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const back = tryFromDatetimeLocalValue(local);
    expect(back).toBeTruthy();
    expect(new Date(back!).getTime()).not.toBeNaN();
  });

  it('rejects incomplete datetime strings', () => {
    expect(tryFromDatetimeLocalValue('2026-07')).toBeUndefined();
    expect(tryFromDatetimeLocalValue('not-a-date')).toBeUndefined();
  });
});
