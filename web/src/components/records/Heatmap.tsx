'use client';

import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { WEEKDAY_KO, addDays, today } from '@/lib/date';
import type { Heatmap as HeatmapData, HeatmapCell } from '@/lib/selectors';

interface Props {
  heatmap: HeatmapData;
  label: string;
  onOpen: (date: string) => void;
}

export function cellLabel(cell: HeatmapCell): string {
  const [, m, d] = cell.date.split('-');
  const missed = cell.missedCount > 0 ? `, 미실천 ${cell.missedCount}회` : '';
  const bonus = cell.bonusCount > 0 ? `, 보너스 ${cell.bonusCount}회` : '';
  return `${Number(m)}월 ${Number(d)}일, ${cell.doneCount}회 완료${missed}${bonus}`;
}

export function Heatmap({ heatmap, label, onOpen }: Props) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const dates = heatmap.cells.map((c) => c.date);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const fallback = dates.includes(today()) ? today() : first;
  const focused = focusedDate && dates.includes(focusedDate) ? focusedDate : fallback;

  const slots: (HeatmapCell | null)[] = [...Array<null>(heatmap.leadingBlanks).fill(null), ...heatmap.cells];
  while (slots.length % 7 !== 0) slots.push(null);
  const rows: (HeatmapCell | null)[][] = [];
  for (let i = 0; i < slots.length; i += 7) rows.push(slots.slice(i, i + 7));

  function move(target: string) {
    if (target < first || target > last) return;
    setFocusedDate(target);
    refs.current[target]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, date: string) {
    const delta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in delta) {
      e.preventDefault();
      move(addDays(date, delta[e.key]));
    } else if (e.key === 'Home') {
      e.preventDefault();
      move(first);
    } else if (e.key === 'End') {
      e.preventDefault();
      move(last);
    }
  }

  return (
    <div role="grid" aria-label={label} className="space-y-1">
      <div role="row" className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-700">
        {WEEKDAY_KO.map((w) => (
          <div key={w} role="columnheader">
            {w}
          </div>
        ))}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} role="row" className="grid grid-cols-7 gap-1">
          {row.map((cell, ci) =>
            cell ? (
              <button
                key={cell.date}
                ref={(el) => {
                  refs.current[cell.date] = el;
                }}
                type="button"
                role="gridcell"
                aria-label={cellLabel(cell)}
                tabIndex={cell.date === focused ? 0 : -1}
                onFocus={() => setFocusedDate(cell.date)}
                onKeyDown={(e) => onKeyDown(e, cell.date)}
                onClick={() => onOpen(cell.date)}
                className={`heat-${cell.level} ${cell.bonusCount > 0 ? 'heat-bonus' : ''} flex min-h-12 flex-col items-center justify-center rounded-md border border-slate-300 text-xs ${
                  cell.date === today() ? 'ring-2 ring-slate-900' : ''
                }`}
              >
                <span className="font-bold">{Number(cell.date.slice(8))}</span>
                <span className="relative z-10 rounded bg-white/80 px-1 text-slate-900">{cell.doneCount}회</span>
                {cell.bonusCount > 0 ? (
                  <span className="relative z-10 rounded bg-violet-100 px-1 text-[10px] font-bold text-violet-900">보너스 {cell.bonusCount}</span>
                ) : null}
              </button>
            ) : (
              <div key={`b-${ri}-${ci}`} role="gridcell" aria-hidden="true" />
            ),
          )}
        </div>
      ))}
    </div>
  );
}

const LEGEND: { level: 0 | 1 | 2 | 3 | 4; text: string }[] = [
  { level: 0, text: '0회 (무늬 없음)' },
  { level: 1, text: '1회 (성긴 빗금)' },
  { level: 2, text: '2회 (빗금)' },
  { level: 3, text: '3회 (촘촘한 빗금)' },
  { level: 4, text: '4회 이상 (아주 촘촘)' },
];

export function HeatmapLegend() {
  return (
    <ul aria-label="히트맵 범례" className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {LEGEND.map((l) => (
        <li key={l.level} className="flex items-center gap-2">
          <span aria-hidden="true" className={`heat-${l.level} inline-block size-6 rounded border border-slate-300`} />
          {l.text}
        </li>
      ))}
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="heat-0 heat-bonus inline-block size-6 rounded border border-slate-300" />
        보너스 (점 무늬)
      </li>
    </ul>
  );
}
