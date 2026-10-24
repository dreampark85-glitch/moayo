'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { DIFFICULTY_LABEL, KIND_LABEL, VERIFICATION_LABEL, amountLabel, verificationOf } from '@/components/mission/labels';
import { SafetyNotice } from '@/components/shell/SafetyNotice';
import { useApp } from '@/components/shell/AppProvider';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { RetryBanner } from '@/components/ui/RetryBanner';
import { formatKo, timeOf } from '@/lib/date';
import { miniAmount } from '@/lib/mini';
import { selectComeback, selectMissionView, selectStreak } from '@/lib/selectors';
import type { MissionView } from '@/lib/selectors';
import type { Difficulty, RecordKind } from '@/lib/types';

type Stage = 'run' | 'review';

const DIFFICULTIES: Difficulty[] = ['easy', 'ok', 'hard'];
const BIG_NUMBER = 'text-[clamp(6rem,32vw,9rem)] font-extrabold leading-none text-slate-900';
const PRIMARY_BTN = 'min-h-14 w-full rounded-xl bg-emerald-700 px-4 text-lg font-bold text-white disabled:opacity-50';
const SECONDARY_BTN = 'min-h-11 rounded-xl border-2 border-slate-500 px-4 font-semibold text-slate-900 disabled:opacity-50';

export function MissionScreen() {
  const { missionId } = useParams<{ missionId: string }>();
  const { state } = useApp();
  const view = selectMissionView(state, missionId);

  if (!view) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900">미션을 찾을 수 없어요</h1>
        <p className="text-slate-700">주소가 잘못되었거나 존재하지 않는 미션이에요.</p>
        <Link href="/" className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 font-bold text-white">
          홈으로 가기
        </Link>
      </div>
    );
  }
  // key로 missionId가 바뀔 때 로컬 단계·카운터를 모두 초기화한다 (언마운트에 의존하지 않음)
  return <MissionFlow key={view.mission.missionId} view={view} />;
}

function MissionFlow({ view }: { view: MissionView }) {
  const { state } = useApp();
  const mode = useSearchParams().get('mode');
  const { goal, mission, record } = view;
  const comeback = selectComeback(state);
  const miniTarget = goal.unit === 'min' ? 1 : miniAmount(goal);
  // 지원하지 않는 mode나 분량 0(미구현/대상 아님)이면 일반 모드로 되돌린다
  let kind: RecordKind = 'normal';
  let target = goal.target;
  let message = '';
  if (mode === 'comeback' && comeback && comeback.missionId === mission.missionId && comeback.amount > 0) {
    kind = 'comeback';
    target = comeback.amount;
    message = comeback.message;
  } else if (mode === 'mini' && miniTarget > 0) {
    kind = 'mini';
    target = miniTarget;
  }
  const [stage, setStage] = useState<Stage>('run');
  const [amount, setAmount] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  if (record) return <DoneStage view={view} />;

  if (stage === 'review') {
    return (
      <ReviewStage
        missionId={mission.missionId}
        unit={goal.unit}
        kind={kind}
        amount={amount}
        durationSec={durationSec}
        onBack={() => setStage('run')}
      />
    );
  }

  function finish(finalAmount: number, sec: number) {
    setAmount(finalAmount);
    setDurationSec(sec);
    setStage('review');
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <Link href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-700 underline">
          홈으로
        </Link>
        <p className="text-sm text-slate-700">{timeOf(mission.scheduledAt)} 예정</p>
      </header>
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          {kind !== 'normal' && (
            <span className="mr-2 rounded-full border-2 border-emerald-800 px-2 py-0.5 align-middle text-sm font-bold text-emerald-900">
              {kind === 'mini' ? '1분 버전' : KIND_LABEL[kind]}
            </span>
          )}
          {goal.exercise} {amountLabel(goal.unit, target)}
        </h1>
        {message && <p className="mt-1 font-semibold text-slate-900">{message}</p>}
        <p className="text-sm text-slate-700">인증 방식: {VERIFICATION_LABEL[verificationOf(goal.unit)]}</p>
      </div>
      {goal.unit === 'rep' && <CountRun target={target} initial={amount} onComplete={(n) => finish(n, 0)} />}
      {goal.unit === 'step' && <StepsRun target={target} initial={amount} onComplete={(n) => finish(n, 0)} />}
      {goal.unit === 'min' && <TimerRun targetMin={target} onComplete={(sec) => finish(target, sec)} />}
      <div className="mt-auto space-y-2">
        <p className="text-xs font-bold text-slate-700">안전 고지</p>
        <p className="font-semibold text-rose-900">통증이 있으면 중단하세요.</p>
        <SafetyNotice />
        
      </div>
    </div>
  );
}

function ProgressBar({ value, target, label }: { value: number; target: number; label: string }) {
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(value, target)}
        className="h-4 w-full overflow-hidden rounded-full bg-slate-200"
      >
        <div className="h-full bg-emerald-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-center text-lg font-bold text-slate-900">
        {value.toLocaleString('ko-KR')} / {target.toLocaleString('ko-KR')} ({pct}%)
      </p>
    </div>
  );
}

export function CountRun({
  target,
  initial,
  onComplete,
  doneLabel = '완료하고 회고하기',
}: {
  target: number;
  initial: number;
  onComplete: (n: number) => void;
  doneLabel?: string;
}) {
  const [count, setCount] = useState(initial);
  return (
    <>
      <p aria-live="polite" aria-atomic="true" className={`text-center ${BIG_NUMBER}`}>
        <span className="sr-only">현재 </span>
        {count}
        <span className="sr-only">회</span>
      </p>
      <button
        type="button"
        onClick={() => setCount((c) => c + 1)}
        className="min-h-56 w-full rounded-3xl bg-emerald-700 text-3xl font-extrabold text-white active:bg-emerald-800"
      >
        탭해서 +1
      </button>
      <button type="button" onClick={() => setCount((c) => Math.max(0, c - 1))} disabled={count === 0} className={SECONDARY_BTN}>
        -1 되돌리기
      </button>
      <ProgressBar value={count} target={target} label="횟수 진행도" />
      <button type="button" onClick={() => onComplete(count)} disabled={count < target} className={PRIMARY_BTN}>
        {doneLabel}
      </button>
    </>
  );
}

export function StepsRun({
  target,
  initial,
  onComplete,
  doneLabel = '완료하고 회고하기',
}: {
  target: number;
  initial: number;
  onComplete: (n: number) => void;
  doneLabel?: string;
}) {
  const [steps, setSteps] = useState(initial);
  return (
    <>
      <p aria-live="polite" aria-atomic="true" className={`text-center ${BIG_NUMBER}`}>
        <span className="sr-only">현재 </span>
        {steps.toLocaleString('ko-KR')}
        <span className="sr-only">보</span>
      </p>
      <button
        type="button"
        onClick={() => setSteps((s) => s + 100)}
        className="min-h-40 w-full rounded-3xl bg-emerald-700 text-3xl font-extrabold text-white active:bg-emerald-800"
      >
        +100보 (시뮬레이션)
      </button>
      <button type="button" onClick={() => setSteps((s) => Math.max(0, s - 100))} disabled={steps === 0} className={SECONDARY_BTN}>
        -100보 되돌리기
      </button>
      <ProgressBar value={steps} target={target} label="걸음 수 진행도" />
      <button type="button" onClick={() => onComplete(steps)} disabled={steps < target} className={PRIMARY_BTN}>
        {doneLabel}
      </button>
    </>
  );
}

function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function TimerRun({
  targetMin,
  onComplete,
  doneLabel = '완료하고 회고하기',
}: {
  targetMin: number;
  onComplete: (sec: number) => void;
  doneLabel?: string;
}) {
  const totalMs = targetMin * 60_000;
  const [remaining, setRemaining] = useState(totalMs);
  const [running, setRunning] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const endAt = useRef(0);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const left = endAt.current - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setRunning(false);
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  // Page Visibility API: 화면을 벗어나면 자동 일시정지
  useEffect(() => {
    if (!running) return;
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        setRemaining(Math.max(0, endAt.current - Date.now()));
        setRunning(false);
        setAutoPaused(true);
      }
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [running]);

  function start() {
    endAt.current = Date.now() + remaining;
    setAutoPaused(false);
    setRunning(true);
  }

  function pause() {
    setRemaining(Math.max(0, endAt.current - Date.now()));
    setRunning(false);
  }

  function skipMinute() {
    if (running) endAt.current -= 60_000;
    else setRemaining((r) => Math.max(0, r - 60_000));
  }

  const finished = remaining <= 0;
  const elapsedMs = totalMs - remaining;

  return (
    <>
      <p className={`text-center tabular-nums ${BIG_NUMBER}`} role="timer" aria-label={`남은 시간 ${formatClock(remaining)}`}>
        {formatClock(remaining)}
      </p>
      <ProgressBar value={Math.round(elapsedMs / 1000)} target={targetMin * 60} label="타이머 진행도(초)" />
      {autoPaused && (
        <div role="status" className="rounded-xl border-2 border-amber-700 bg-amber-50 p-3 font-semibold text-amber-950">
          화면을 벗어나 일시정지됨 — 돌아와서 계속하려면 아래 버튼을 눌러 주세요.
        </div>
      )}
      {!finished && !running && (
        <button type="button" onClick={start} className={PRIMARY_BTN}>
          {autoPaused ? '다시 시작' : elapsedMs > 0 ? '계속하기' : '시작'}
        </button>
      )}
      {running && (
        <button type="button" onClick={pause} className={`${PRIMARY_BTN} bg-slate-800`}>
          일시정지
        </button>
      )}
      {!finished && (
        <button type="button" onClick={skipMinute} className={SECONDARY_BTN}>
          시연: 1분 건너뛰기
        </button>
      )}
      <button type="button" onClick={() => onComplete(Math.round(totalMs / 1000))} disabled={!finished} className={PRIMARY_BTN}>
        {doneLabel}
      </button>
    </>
  );
}

interface ReviewProps {
  missionId: string;
  unit: MissionView['goal']['unit'];
  kind: RecordKind;
  amount: number;
  durationSec: number;
  onBack: () => void;
}

function ReviewStage({ missionId, unit, kind, amount, durationSec, onBack }: ReviewProps) {
  const { api } = useApp();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!difficulty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await api.saveRecord({ missionId, amount, durationSec, verification: verificationOf(unit), difficulty, memo, kind });
    } catch (e) {
      setError(e instanceof Error ? e.message : '기록 저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold text-slate-900">오늘 어땠나요?</h1>
      <p className="text-sm text-slate-700">
        {kind !== 'normal' && `[${kind === 'mini' ? '1분 버전' : KIND_LABEL[kind]}] `}
        기록할 분량: {amountLabel(unit, amount)} ({VERIFICATION_LABEL[verificationOf(unit)]})
      </p>
      <div role="radiogroup" aria-labelledby="difficulty-label" className="space-y-2">
        <p id="difficulty-label" className="font-semibold text-slate-900">
          체감 난이도
        </p>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTIES.map((d) => (
            <label
              key={d}
              className={`flex min-h-16 cursor-pointer items-center justify-center rounded-xl border-2 px-2 text-center text-lg font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-emerald-700 ${
                difficulty === d ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-400 bg-white text-slate-900'
              }`}
            >
              <input
                type="radio"
                name="difficulty"
                value={d}
                checked={difficulty === d}
                onChange={() => setDifficulty(d)}
                className="sr-only"
              />
              {difficulty === d && <span aria-hidden="true">✓ </span>}
              {DIFFICULTY_LABEL[d]}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="memo" className="font-semibold text-slate-900">
          메모 (선택)
        </label>
        <textarea
          id="memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          disabled={saving}
          rows={3}
          placeholder="통증이 있었다면 적어 주세요. 통증 메모가 있으면 해당 운동 추천을 멈춰요."
          className="mt-1 w-full rounded-xl border-2 border-slate-400 p-3 text-base text-slate-900"
        />
      </div>
      <SafetyNotice />
      {error && <RetryBanner message={error} onRetry={save} retrying={saving} />}
      <LiveRegion message={saving ? '기록을 저장하는 중' : ''} />
      <p className="text-sm text-slate-700" aria-hidden={!saving}>
        {saving ? '저장하는 중…' : ''}
      </p>
      <div className="mt-auto space-y-2">
        <button type="button" onClick={save} disabled={!difficulty || saving} className={PRIMARY_BTN}>
          {saving ? '저장하는 중…' : '기록 저장'}
        </button>
        {!difficulty && <p className="text-center text-sm text-slate-700">난이도를 먼저 선택해 주세요.</p>}
        <button type="button" onClick={onBack} disabled={saving} className={`${SECONDARY_BTN} w-full`}>
          운동 화면으로 돌아가기
        </button>
      </div>
    </div>
  );
}

function DoneStage({ view }: { view: MissionView }) {
  const { state } = useApp();
  const { goal, mission, record } = view;
  const streak = selectStreak(state);
  if (!record) return null;
  const done = record.status === 'done';

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-3xl font-extrabold text-slate-900">
        {done ? '오늘 미션 완료!' : '미실천으로 기록된 미션이에요'}
      </h1>
      <p className="text-slate-700" role="status">
        {done ? '잘했어요. 기록이 저장되었고 다음 계획에 반영돼요.' : '다음 미션에서 다시 시작해 봐요.'}
      </p>
      <section aria-label="스트릭" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
        <p className="text-lg font-bold">연속 {streak.current}일 실천 중</p>
        <p className="text-sm">
          최장 {streak.longest}일 · 보호권 {streak.protectionLeft > 0 ? `${streak.protectionLeft}개 남음` : '이번 달 사용함'}
        </p>
      </section>
      <section aria-label="기록 요약" className="rounded-xl border border-slate-300 p-3 text-slate-900">
        <h2 className="mb-1 font-bold">
          {formatKo(mission.date)} {goal.exercise}
          {done && record.kind !== 'normal' && (
            <span className="ml-2 rounded-full border-2 border-emerald-800 px-2 py-0.5 text-sm font-bold text-emerald-900">
              {KIND_LABEL[record.kind]}
            </span>
          )}
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-slate-600">상태</dt>
          <dd>{done ? '완료' : '미실천'}</dd>
          {done && (
            <>
              <dt className="text-slate-600">분량</dt>
              <dd>{amountLabel(goal.unit, record.amount)}</dd>
              <dt className="text-slate-600">시간</dt>
              <dd>{Math.max(1, Math.round(record.durationSec / 60))}분</dd>
              <dt className="text-slate-600">인증</dt>
              <dd>{VERIFICATION_LABEL[record.verification]}</dd>
              <dt className="text-slate-600">난이도</dt>
              <dd>{record.difficulty ? DIFFICULTY_LABEL[record.difficulty] : '-'}</dd>
              {record.memo && (
                <>
                  <dt className="text-slate-600">메모</dt>
                  <dd>{record.memo}</dd>
                </>
              )}
            </>
          )}
        </dl>
      </section>
      <nav aria-label="다음 이동" className="grid gap-2">
        <Link href="/records" className="flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-500 px-4 font-semibold text-slate-900">
          기록 보기
        </Link>
        <Link href="/plan" className="flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-500 px-4 font-semibold text-slate-900">
          다음 계획 보기
        </Link>
        <Link href="/" className="flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 font-bold text-white">
          홈으로
        </Link>
      </nav>
    </div>
  );
}
