// 날짜 유틸. 앱에서 '오늘'은 today() 하나만 사용한다.
// 실제 기기의 당일 날짜(로컬)를 쓰고, 검증 스크립트만 setToday()로 날짜를 고정할 수 있다.
import type { ISODate, ISODateTime, Weekday } from './types.ts';

export const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

let todayOverride: ISODate | null = null;

/** 검증 스크립트 전용: 날짜를 고정한다. null이면 실제 오늘 날짜로 복귀 */
export function setToday(d: ISODate | null): void {
  todayOverride = d;
}

export function today(): ISODate {
  if (todayOverride) return todayOverride;
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

function toUtc(d: ISODate): Date {
  return new Date(`${d}T00:00:00Z`);
}

function fromUtc(dt: Date): ISODate {
  return dt.toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  const dt = toUtc(d);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUtc(dt);
}

/** a - b (일 수) */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86_400_000);
}

export function weekdayOf(d: ISODate): Weekday {
  return toUtc(d).getUTCDay() as Weekday;
}

/** 월요일 시작 주의 시작일 */
export function startOfWeek(d: ISODate): ISODate {
  const wd = weekdayOf(d);
  return addDays(d, -((wd + 6) % 7));
}

export function monthKey(d: ISODate): string {
  return d.slice(0, 7);
}

export function dateOf(dt: ISODateTime): ISODate {
  return dt.slice(0, 10);
}

export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

export function compactDate(d: ISODate): string {
  return d.replaceAll('-', '');
}

export function formatKo(d: ISODate): string {
  const [, m, day] = d.split('-');
  return `${Number(m)}월 ${Number(day)}일 (${WEEKDAY_KO[weekdayOf(d)]})`;
}

export function makeDateTime(d: ISODate, hhmm: string): ISODateTime {
  return `${d}T${hhmm}:00`;
}

export function timeOf(dt: ISODateTime): string {
  return dt.slice(11, 16);
}
