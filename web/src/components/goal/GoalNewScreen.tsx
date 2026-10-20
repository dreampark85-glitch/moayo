'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useApp, useScreenReady } from '@/components/shell/AppProvider';
import { SafetyNotice } from '@/components/shell/SafetyNotice';
import { Field, inputClass } from '@/components/ui/Field';
import { LiveRegion } from '@/components/ui/LiveRegion';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { validateGoalInput } from '@/lib/api';
import { WEEKDAY_KO } from '@/lib/date';
import { MAX_AMOUNT, MIN_AMOUNT, UNIT_STEP } from '@/lib/recommendation';
import { BODY_PART_LABEL, TEMPLATES, UNIT_LABEL, templateToInput } from '@/lib/templates';
import type { BodyPart, GoalInput, Unit, Weekday } from '@/lib/types';

const WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const UNITS: Unit[] = ['rep', 'min', 'step'];
const BODY_PARTS = Object.keys(BODY_PART_LABEL) as BodyPart[];

const BLANK: GoalInput = {
  exercise: '',
  bodyPart: 'full',
  unit: 'rep',
  target: 10,
  weekdays: [1, 3, 5],
  time: '07:00',
  durationWeeks: 2,
};

function rangeHint(unit: Unit): string {
  const max = MAX_AMOUNT[unit];
  return Number.isFinite(max)
    ? `${MIN_AMOUNT[unit]}~${max}${UNIT_LABEL[unit]}`
    : `${MIN_AMOUNT[unit]}${UNIT_LABEL[unit]} 이상`;
}

export function GoalNewScreen() {
  const { api } = useApp();
  const ready = useScreenReady('goals-new');
  const router = useRouter();
  const [form, setForm] = useState<GoalInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <ScreenSkeleton label="목표 만들기를 불러오는 중" />;

  function patch(p: Partial<GoalInput>) {
    setForm((f) => (f ? { ...f, ...p } : f));
    setError(null);
  }

  function toggleDay(d: Weekday) {
    if (!form) return;
    const has = form.weekdays.includes(d);
    patch({ weekdays: (has ? form.weekdays.filter((x) => x !== d) : [...form.weekdays, d]).sort() });
  }

  async function submit() {
    if (!form) return;
    const invalid = validateGoalInput(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createGoal(form);
      router.push('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : '목표를 만들지 못했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 p-4">
      <h1 className="text-xl font-bold">새 목표 만들기</h1>
      <SafetyNotice />

      <section aria-labelledby="tpl-title" className="space-y-2">
        <h2 id="tpl-title" className="text-base font-bold">
          1. 템플릿 고르기
        </h2>
        <ul className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => {
            const selected = form?.templateId === t.templateId;
            return (
              <li key={t.templateId}>
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setForm(templateToInput(t));
                    setError(null);
                  }}
                  className={`min-h-16 w-full rounded-xl border-2 p-2 text-left text-sm ${
                    selected ? 'border-emerald-700 bg-emerald-50 font-bold' : 'border-slate-300'
                  }`}
                >
                  {selected ? <span aria-hidden="true">✓ </span> : null}
                  {t.name}
                  <span className="block text-xs font-normal text-slate-600">{BODY_PART_LABEL[t.bodyPart]}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={() => {
            setForm({ ...BLANK });
            setError(null);
          }}
          className="min-h-11 rounded-lg border-2 border-dashed border-slate-400 px-3 text-sm font-semibold"
        >
          템플릿 없이 직접 입력
        </button>
      </section>

      {form ? (
        <form
          aria-labelledby="form-title"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <h2 id="form-title" className="text-base font-bold">
            2. 내용 확인하고 만들기
          </h2>
          <Field label="운동 종류" required>
            {(c) => (
              <input
                {...c}
                type="text"
                required
                aria-required="true"
                value={form.exercise}
                onChange={(e) => patch({ exercise: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label={`분량 (${UNIT_LABEL[form.unit]})`} hint={`가능 범위: ${rangeHint(form.unit)}`} required>
            {(c) => (
              <input
                {...c}
                type="number"
                inputMode="numeric"
                required
                aria-required="true"
                min={MIN_AMOUNT[form.unit]}
                max={Number.isFinite(MAX_AMOUNT[form.unit]) ? MAX_AMOUNT[form.unit] : undefined}
                step={UNIT_STEP[form.unit]}
                value={Number.isNaN(form.target) ? '' : form.target}
                onChange={(e) => patch({ target: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label="단위">
            {(c) => (
              <select {...c} value={form.unit} onChange={(e) => patch({ unit: e.target.value as Unit })} className={inputClass}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">
              요일 <span aria-hidden="true">*</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <label
                  key={d}
                  className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-lg border-2 px-2 text-sm ${
                    form.weekdays.includes(d) ? 'border-emerald-700 bg-emerald-50 font-bold' : 'border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.weekdays.includes(d)}
                    onChange={() => toggleDay(d)}
                    className="size-4 accent-emerald-700"
                  />
                  {WEEKDAY_KO[d]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="알림 시각" required>
            {(c) => (
              <input
                {...c}
                type="time"
                required
                aria-required="true"
                value={form.time}
                onChange={(e) => patch({ time: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
          <Field label="기간">
            {(c) => (
              <select
                {...c}
                value={form.durationWeeks}
                onChange={(e) => patch({ durationWeeks: Number(e.target.value) as GoalInput['durationWeeks'] })}
                className={inputClass}
              >
                {([1, 2, 3, 4] as const).map((w) => (
                  <option key={w} value={w}>
                    {w}주
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="부위">
            {(c) => (
              <select {...c} value={form.bodyPart} onChange={(e) => patch({ bodyPart: e.target.value as BodyPart })} className={inputClass}>
                {BODY_PARTS.map((b) => (
                  <option key={b} value={b}>
                    {BODY_PART_LABEL[b]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <div aria-live="polite" role={error ? 'alert' : undefined} className="text-sm font-semibold text-rose-800">
            {error ? `오류: ${error}` : ''}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 font-bold text-white disabled:opacity-60"
          >
            {saving ? '만드는 중…' : '목표 만들기'}
          </button>
        </form>
      ) : (
        <p className="text-sm text-slate-600">템플릿을 고르면 입력 폼이 나타나요.</p>
      )}
      <LiveRegion message={saving ? '목표를 저장하는 중이에요' : ''} />
    </div>
  );
}
