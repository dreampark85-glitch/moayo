// .ics 캘린더 내보내기 (순수 문자열 생성, RFC5545, CRLF, 네트워크 없음).
// 진행 중(active) 목표마다 VEVENT 1개: 시작일 이후 첫 목표 요일 21:00 같은 로컬 시각(Asia/Seoul)부터 주간 반복, 종료일까지.
import { addDays, weekdayOf } from './date.ts';
import { unitSuffix } from './recommendation.ts';
import type { Goal, ISODate, Weekday } from './types.ts';

const BYDAY: Record<Weekday, string> = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };
const ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
const KST_OFFSET_HOURS = 9;

const compact = (d: ISODate) => d.replaceAll('-', '');
const hhmmss = (hhmm: string) => `${hhmm.replace(':', '')}00`;

/** Asia/Seoul 로컬 일시 → UTC 'YYYYMMDDTHHMMSSZ' */
function kstToUtc(date: ISODate, hhmm: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = hhmm.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, h - KST_OFFSET_HOURS, min, 0));
  return dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function escapeText(s: string): string {
  return s.replaceAll('\\', '\\\\').replaceAll(';', '\\;').replaceAll(',', '\\,').replace(/\r?\n/g, '\\n');
}

/** 75옥텟(UTF-8)을 넘는 줄을 CRLF+공백으로 접는다. 멀티바이트 문자는 쪼개지 않는다 */
export function foldLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > limit) {
      out.push(cur);
      cur = ' ';
      bytes = 1;
      limit = 75;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out;
}

function firstOccurrence(goal: Goal): ISODate | null {
  for (let i = 0; i < 7; i++) {
    const d = addDays(goal.startDate, i);
    if (goal.weekdays.includes(weekdayOf(d))) return d <= goal.endDate ? d : null;
  }
  return null;
}

/** now: 'YYYY-MM-DDTHH:mm:ss' (Asia/Seoul 로컬, DTSTAMP용) */
export function buildIcs(goals: Goal[], now: string): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MOAYO//Goals//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-TIMEZONE:Asia/Seoul',
    'BEGIN:VTIMEZONE',
    'TZID:Asia/Seoul',
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0900',
    'TZOFFSETTO:+0900',
    'TZNAME:KST',
    'END:STANDARD',
    'END:VTIMEZONE',
  ];
  const stamp = kstToUtc(now.slice(0, 10), now.slice(11, 16));
  for (const g of goals.filter((x) => x.status === 'active')) {
    const first = firstOccurrence(g);
    if (!first) continue;
    const byday = ORDER.filter((w) => g.weekdays.includes(w)).map((w) => BYDAY[w]).join(',');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${g.goalId}@moayo.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Asia/Seoul:${compact(first)}T${hhmmss(g.time)}`,
      'DURATION:PT10M',
      `RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${kstToUtc(g.endDate, g.time)}`,
      `SUMMARY:${escapeText(`MOAYO ${g.exercise} ${g.target}${unitSuffix(g.unit)}`)}`,
      `DESCRIPTION:${escapeText(`${g.exercise} ${g.target}${unitSuffix(g.unit)} 미션 시간이에요.`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.flatMap(foldLine).join('\r\n') + '\r\n';
}
