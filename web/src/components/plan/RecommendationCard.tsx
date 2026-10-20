'use client';

import { useState } from 'react';
import { Field, inputClass } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import type { ApplyItem } from '@/lib/api';
import { MAX_AMOUNT, MIN_AMOUNT, UNIT_STEP, increaseAmount } from '@/lib/recommendation';
import type { RecommendationView } from '@/lib/selectors';
import { UNIT_LABEL } from '@/lib/templates';
import { RESPONSE_LABEL, RULE_LABEL } from './labels';

interface Props {
  view: RecommendationView;
  onApply: (item: ApplyItem) => Promise<void>;
  onClearPain: (exercise: string) => Promise<void>;
}

function EditModal({ view, onClose, onApply }: { view: RecommendationView; onClose: () => void; onApply: Props['onApply'] }) {
  const { goal, result, suggestedTime } = view;
  const [amountText, setAmountText] = useState(String(result.proposedAmount));
  const [changeTime, setChangeTime] = useState(suggestedTime !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unit = UNIT_LABEL[goal.unit];
  const amount = Number(amountText);
  const upper = Math.min(increaseAmount(goal.target, goal.unit), MAX_AMOUNT[goal.unit]);
  let fieldError: string | null = null;
  if (amountText.trim() === '' || !Number.isInteger(amount)) fieldError = '정수로 입력해 주세요.';
  else if (amount < MIN_AMOUNT[goal.unit]) fieldError = `${MIN_AMOUNT[goal.unit]}${unit} 이상이어야 해요.`;
  else if (amount > goal.target && amount > upper) fieldError = `한 번에 최대 +20%까지만 올릴 수 있어요 (${upper}${unit} 이하).`;
  else if (amount > MAX_AMOUNT[goal.unit]) fieldError = `${MAX_AMOUNT[goal.unit]}${unit} 이하여야 해요.`;
  else if (amount % UNIT_STEP[goal.unit] !== 0) fieldError = `${UNIT_STEP[goal.unit]}${unit} 단위로 입력해 주세요.`;

  async function save() {
    if (fieldError) return;
    setBusy(true);
    setError(null);
    try {
      await onApply({
        goalId: goal.goalId,
        rule: result.rule,
        response: 'edited',
        amount,
        time: changeTime && suggestedTime ? suggestedTime : undefined,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했어요.');
      setBusy(false);
    }
  }

  return (
    <Modal open title={`${goal.exercise} 수정`} onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field
          label={`다음 분량 (${unit})`}
          hint={`현재 ${goal.target}${unit} · 가능 범위 ${MIN_AMOUNT[goal.unit]}~${upper}${unit}`}
          error={fieldError}
          required
        >
          {(c) => (
            <input
              {...c}
              type="number"
              inputMode="numeric"
              aria-required="true"
              min={MIN_AMOUNT[goal.unit]}
              max={upper}
              step={UNIT_STEP[goal.unit]}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        {result.rule === 'ok_hold' && result.plus10Amount !== null ? (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-emerald-700"
              checked={amountText === String(result.plus10Amount)}
              onChange={(e) => setAmountText(String(e.target.checked ? result.plus10Amount : goal.target))}
            />
            분량 +10% 적용 ({result.plus10Amount}
            {unit})
          </label>
        ) : null}
        {suggestedTime ? (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-emerald-700"
              checked={changeTime}
              onChange={(e) => setChangeTime(e.target.checked)}
            />
            시간대 변경 ({goal.time} → {suggestedTime})
          </label>
        ) : null}
        <div aria-live="assertive" role={error ? 'alert' : undefined} className="text-sm font-semibold text-rose-800">
          {error ? `오류: ${error}` : ''}
        </div>
        <button
          type="submit"
          disabled={busy || fieldError !== null}
          className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-60"
        >
          {busy ? '저장하는 중…' : '수정한 값으로 확정'}
        </button>
      </form>
    </Modal>
  );
}

export function RecommendationCard({ view, onApply, onClearPain }: Props) {
  const { goal, result, suggestedTime, latest } = view;
  const unit = UNIT_LABEL[goal.unit];
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<void>, done: string) {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await task();
      setNotice(done);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  function respond(response: 'accepted' | 'skipped') {
    void run(
      () =>
        onApply({
          goalId: goal.goalId,
          rule: result.rule,
          response,
          amount: response === 'accepted' ? result.proposedAmount : goal.target,
          time: response === 'accepted' && suggestedTime ? suggestedTime : undefined,
        }),
      `응답이 기록됐어요: ${RESPONSE_LABEL[response]}`,
    );
  }

  const btn = 'min-h-11 rounded-lg px-4 text-sm font-bold disabled:opacity-60';
  const changed = result.proposedAmount !== result.currentAmount;
  const noAccept = result.atCap || result.atMin;

  if (result.stop) {
    return (
      <article aria-label={`${goal.exercise} 휴식 권고`} className="space-y-2 rounded-xl border-2 border-rose-700 bg-rose-50 p-4">
        <p className="text-xs font-bold text-rose-900">
          <span aria-hidden="true">⛔ </span>
          {RULE_LABEL[result.rule]}
        </p>
        <h3 className="text-lg font-bold">{goal.exercise} · 휴식 권고</h3>
        <p className="text-sm">{result.message}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => onClearPain(goal.exercise), '추천을 다시 시작했어요.')}
          className={`${btn} border-2 border-rose-800 bg-white text-rose-900`}
        >
          {busy ? '처리하는 중…' : '다시 시작'}
        </button>
        <div aria-live="polite" className="text-sm font-semibold">{notice}</div>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-rose-800">
            오류: {error}
          </p>
        ) : null}
      </article>
    );
  }

  return (
    <article aria-label={`${goal.exercise} 추천`} className="space-y-2 rounded-xl border border-slate-300 p-4">
      <p className="inline-block rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">{RULE_LABEL[result.rule]}</p>
      <h3 className="text-lg font-bold">{goal.exercise}</h3>
      <p className="text-base">
        {changed ? (
          <>
            {result.currentAmount}
            {unit} <span aria-label="에서">→</span> <strong>{result.proposedAmount}{unit}</strong>
          </>
        ) : (
          <>
            <strong>
              {result.currentAmount}
              {unit}
            </strong>{' '}
            유지
          </>
        )}
        {suggestedTime ? <span className="block text-sm">시간대 제안: {goal.time} → {suggestedTime}</span> : null}
      </p>
      <p className="text-sm">{result.message}</p>
      {result.extras.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {result.extras.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      ) : null}
      {result.warnings.map((w) => (
        <p key={w} className="rounded-lg border-2 border-amber-600 bg-amber-50 p-2 text-sm font-semibold text-amber-950">
          <span aria-hidden="true">⚠ </span>
          <span className="sr-only">경고: </span>
          {w}
        </p>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        {!noAccept ? (
          <button type="button" disabled={busy} onClick={() => respond('accepted')} className={`${btn} bg-emerald-700 text-white`}>
            수락
          </button>
        ) : null}
        {!result.atCap ? (
          <button type="button" disabled={busy} onClick={() => setEditing(true)} className={`${btn} border-2 border-slate-500`}>
            수정
          </button>
        ) : null}
        <button type="button" disabled={busy} onClick={() => respond('skipped')} className={`${btn} border-2 border-slate-300`}>
          건너뛰기
        </button>
      </div>
      {busy ? <p className="text-sm text-slate-700">저장하는 중…</p> : null}
      <div aria-live="polite" className="text-sm font-semibold text-emerald-900">
        {notice}
      </div>
      {latest && !notice ? (
        <p className="text-xs text-slate-600">
          최근 응답: {RESPONSE_LABEL[latest.response]} ({RULE_LABEL[latest.rule]}, {latest.proposedAmount}
          {unit})
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-semibold text-rose-800">
          오류: {error}
        </p>
      ) : null}
      {editing ? <EditModal view={view} onClose={() => setEditing(false)} onApply={onApply} /> : null}
    </article>
  );
}
