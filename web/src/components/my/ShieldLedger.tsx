'use client';

import { formatKo } from '@/lib/date';
import type { ShieldLedgerEntry } from '@/lib/types';

const TYPE_LABEL: Record<ShieldLedgerEntry['type'], string> = { monthly: '지급', earned: '획득', used: '사용' };

export function ShieldLedger({ entries }: { entries: ShieldLedgerEntry[] }) {
  return (
    <section aria-labelledby="shield-ledger-title" className="space-y-2">
      <h2 id="shield-ledger-title" className="text-base font-bold">
        보호권 내역
      </h2>
      {entries.length === 0 ? (
        <p className="rounded-lg bg-slate-100 p-3 text-sm">아직 보호권 내역이 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((e, i) => (
            <li key={`${e.date}-${e.type}-${i}`} className="flex items-start gap-3 rounded-lg border border-slate-300 p-3 text-sm">
              <span className="shrink-0 rounded bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-900">{TYPE_LABEL[e.type]}</span>
              <span>
                <span className="font-semibold">{formatKo(e.date)}</span>
                <span className="block text-slate-700">{e.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
