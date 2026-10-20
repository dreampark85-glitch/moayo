'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';

interface ControlProps {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
}

interface Props {
  label: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  /** 라벨과 연결할 컨트롤(input/select/textarea)에 펼쳐서 전달할 props */
  children: (control: ControlProps) => ReactNode;
}

export function Field({ label, hint, error, required = false, children }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-semibold">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint ? (
        <p id={hintId} className="text-xs text-slate-600">
          {hint}
        </p>
      ) : null}
      <p id={errorId} aria-live="polite" className="min-h-0 text-sm font-semibold text-rose-800">
        {error ? `오류: ${error}` : ''}
      </p>
    </div>
  );
}

export const inputClass =
  'min-h-11 w-full rounded-lg border border-slate-400 bg-white px-3 text-base aria-[invalid=true]:border-rose-700';
