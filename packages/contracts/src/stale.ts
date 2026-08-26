import { ISODateSchema, type ISODate, type StaleStatus } from './schemas';

function toUtcDate(value: ISODate): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function countWeekdaysAfter(asOf: ISODate, checkedAt: ISODate): number {
  ISODateSchema.parse(asOf);
  ISODateSchema.parse(checkedAt);
  if (checkedAt <= asOf) return 0;

  const cursor = toUtcDate(asOf);
  const end = toUtcDate(checkedAt);
  let weekdays = 0;

  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) weekdays += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return weekdays;
}

export function assessStaleness(asOf: ISODate, checkedAt: ISODate): StaleStatus {
  const businessDaysBehind = countWeekdaysAfter(asOf, checkedAt);
  return {
    isStale: businessDaysBehind >= 2,
    asOf,
    checkedAt,
    businessDaysBehind,
    thresholdBusinessDays: 2,
  };
}
