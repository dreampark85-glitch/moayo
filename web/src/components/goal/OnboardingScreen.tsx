'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp, useScreenReady } from '@/components/shell/AppProvider';
import { SafetyNotice } from '@/components/shell/SafetyNotice';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { suggestFirstGoal } from '@/lib/onboarding';
import type { Frequency, OnboardingAnswers, Place, PreferredTime } from '@/lib/onboarding';
import { BODY_PART_LABEL, UNIT_LABEL } from '@/lib/templates';
import { WEEKDAY_KO } from '@/lib/date';

interface Question<T extends string> {
  key: keyof OnboardingAnswers;
  legend: string;
  options: { value: T; label: string }[];
}

const FREQUENCY: Question<Frequency> = {
  key: 'frequency',
  legend: '1. 요즘 운동은 얼마나 하나요?',
  options: [
    { value: 'none', label: '거의 안 해요' },
    { value: 'light', label: '가끔 해요 (주 1~2회)' },
    { value: 'regular', label: '꾸준히 해요 (주 3회 이상)' },
  ],
};
const TIME: Question<PreferredTime> = {
  key: 'time',
  legend: '2. 언제 운동하기 편한가요?',
  options: [
    { value: 'morning', label: '아침' },
    { value: 'lunch', label: '점심' },
    { value: 'evening', label: '저녁' },
    { value: 'night', label: '밤' },
  ],
};
const PLACE: Question<Place> = {
  key: 'place',
  legend: '3. 어디에서 운동할 수 있나요?',
  options: [
    { value: 'home', label: '집' },
    { value: 'outdoor', label: '야외' },
    { value: 'office', label: '사무실' },
  ],
};

type Draft = Partial<OnboardingAnswers>;

function RadioQuestion<T extends string>({
  question,
  value,
  onChange,
}: {
  question: Question<T>;
  value: T | undefined;
  onChange: (v: T) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-base font-bold">{question.legend}</legend>
      {question.options.map((o) => (
        <label
          key={o.value}
          className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border-2 px-3 ${
            value === o.value ? 'border-emerald-700 bg-emerald-50 font-semibold' : 'border-slate-300'
          }`}
        >
          <input
            type="radio"
            name={question.key}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="size-5 accent-emerald-700"
          />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

export function OnboardingScreen() {
  const { api } = useApp();
  const ready = useScreenReady('onboarding');
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({});
  const [answers, setAnswers] = useState<OnboardingAnswers | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <ScreenSkeleton label="온보딩을 불러오는 중" />;

  const complete = draft.frequency && draft.time && draft.place;
  const suggestion = answers ? suggestFirstGoal(answers) : null;

  async function accept() {
    if (!suggestion) return;
    setSaving(true);
    setError(null);
    try {
      await api.completeOnboarding(suggestion.goal);
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장에 실패했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-xl font-bold">처음 목표 정하기</h1>
      <SafetyNotice />
      {suggestion ? (
        <section aria-labelledby="suggest-title" className="space-y-3">
          <h2 id="suggest-title" className="text-lg font-bold">
            이 목표로 시작해 볼까요?
          </h2>
          <div className="rounded-xl border-2 border-emerald-700 p-4">
            <p className="text-lg font-bold">
              {suggestion.goal.exercise} {suggestion.goal.target}
              {UNIT_LABEL[suggestion.goal.unit]}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {suggestion.goal.weekdays.map((d) => WEEKDAY_KO[d]).join('·')} {suggestion.goal.time} ·{' '}
              {suggestion.goal.durationWeeks}주 · {BODY_PART_LABEL[suggestion.goal.bodyPart]}
            </p>
            <p className="mt-2 text-sm">{suggestion.reason}</p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={accept}
              disabled={saving}
              className="min-h-12 rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-60"
            >
              {saving ? '저장하는 중…' : '이 목표로 시작'}
            </button>
            <Link
              href="/goals/new"
              className="flex min-h-12 items-center justify-center rounded-xl border-2 border-slate-400 px-4 font-semibold"
            >
              직접 수정
            </Link>
            <button
              type="button"
              onClick={() => setAnswers(null)}
              disabled={saving}
              className="min-h-11 rounded-xl px-4 text-sm font-semibold underline disabled:opacity-60"
            >
              질문 다시 답하기
            </button>
          </div>
        </section>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (draft.frequency && draft.time && draft.place) {
              setAnswers({ frequency: draft.frequency, time: draft.time, place: draft.place });
            }
          }}
        >
          <RadioQuestion question={FREQUENCY} value={draft.frequency} onChange={(v) => setDraft({ ...draft, frequency: v })} />
          <RadioQuestion question={TIME} value={draft.time} onChange={(v) => setDraft({ ...draft, time: v })} />
          <RadioQuestion question={PLACE} value={draft.place} onChange={(v) => setDraft({ ...draft, place: v })} />
          <button
            type="submit"
            disabled={!complete}
            className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-50"
          >
            첫 목표 추천받기
          </button>
          {!complete ? <p className="text-xs text-slate-600">세 질문에 모두 답하면 버튼이 켜져요.</p> : null}
        </form>
      )}
      <div aria-live="assertive" role={error ? 'alert' : undefined} className="text-sm font-semibold text-rose-800">
        {error ? `오류: ${error}` : ''}
      </div>
      <LiveRegion message={saving ? '목표를 저장하는 중이에요' : ''} />
    </div>
  );
}
