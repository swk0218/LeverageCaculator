import { ISODateSchema, type ISODate } from '@yangbok/contracts';

export function dateInSeoul(instant: Date): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
  return ISODateSchema.parse(`${value.year}-${value.month}-${value.day}`);
}

export function shiftDate(value: ISODate, days: number): ISODate {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return ISODateSchema.parse(date.toISOString().slice(0, 10));
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const start = new Date(`${from}T00:00:00.000Z`).valueOf();
  const end = new Date(`${to}T00:00:00.000Z`).valueOf();
  return Math.floor((end - start) / 86_400_000);
}
