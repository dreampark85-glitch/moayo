'use client';

import { Modal } from '@/components/ui/Modal';
import { formatKo, today } from '@/lib/date';
import type { DayItem } from '@/lib/selectors';
import { UNIT_LABEL } from '@/lib/templates';
import type { Difficulty, PracticeRecord, Verification } from '@/lib/types';
import { RECORD_KIND_LABEL } from '@/components/plan/labels';

const VERIFICATION_LABEL: Record<Verification, string> = { manual: '수동', auto: '자동', simulated: '시뮬레이션' };
const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: '쉬워요', ok: '적당해요', hard: '힘들어요' };

interface Props {
  date: string | null;
  items: DayItem[];
  bonus: PracticeRecord[];
  onClose: () => void;
}

function statusText(item: DayItem, date: string): string {
  if (item.record) return item.record.status === 'done' ? '완료' : '미실천';
  return date >= today() ? '예정 (아직 기록 없음)' : '미실천 (기록 없음)';
}

export function DayDetailModal({ date, items, bonus, onClose }: Props) {
  return (
    <Modal open={date !== null} title={date ? `${formatKo(date)} 기록` : '기록'} onClose={onClose}>
      {date && items.length === 0 && bonus.length === 0 ? <p className="text-sm">이 날은 예정된 운동도, 기록도 없어요.</p> : null}
      <ul className="space-y-3">
        {date
          ? items.map((item) => {
              const { goal, record } = item;
              const amount = record && record.status === 'done' ? record.amount : goal.target;
              return (
                <li key={goal.goalId} className="rounded-xl border border-slate-300 p-3 text-sm">
                  <p className="text-base font-bold">
                    {goal.exercise}
                    {record ? (
                      <span className="ml-2 rounded bg-slate-200 px-2 py-0.5 align-middle text-xs font-semibold text-slate-900">
                        {RECORD_KIND_LABEL[record.kind]}
                      </span>
                    ) : null}
                  </p>
                  <dl className="mt-1 grid grid-cols-[5rem_1fr] gap-y-1">
                    <dt className="text-slate-600">상태</dt>
                    <dd className="font-semibold">{statusText(item, date)}</dd>
                    <dt className="text-slate-600">분량</dt>
                    <dd>
                      {amount}
                      {UNIT_LABEL[goal.unit]}
                    </dd>
                    {record && record.status === 'done' ? (
                      <>
                        <dt className="text-slate-600">인증방식</dt>
                        <dd>{VERIFICATION_LABEL[record.verification]}</dd>
                        <dt className="text-slate-600">난이도</dt>
                        <dd>{record.difficulty ? DIFFICULTY_LABEL[record.difficulty] : '-'}</dd>
                        <dt className="text-slate-600">메모</dt>
                        <dd>{record.memo || '없음'}</dd>
                      </>
                    ) : null}
                  </dl>
                </li>
              );
            })
          : null}
        {date
          ? bonus.map((r) => (
              <li key={r.recordId} className="rounded-xl border border-violet-400 bg-violet-50 p-3 text-sm">
                <p className="text-base font-bold">
                  <span className="rounded bg-violet-200 px-2 py-0.5 text-xs font-semibold text-violet-900">보너스</span>{' '}
                  {r.memo || '보너스 실천'}
                </p>
                <p className="mt-1">
                  분량 {r.amount} · {VERIFICATION_LABEL[r.verification]}
                </p>
                <p className="mt-1 text-xs text-slate-700">보너스는 실천 횟수·스트릭에 포함되지 않아요.</p>
              </li>
            ))
          : null}
      </ul>
    </Modal>
  );
}
