'use client';

interface Props {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
}

export function RetryBanner({ message, onRetry, retrying = false }: Props) {
  return (
    <div role="alert" aria-live="assertive" className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="mt-2 min-h-11 rounded-lg bg-rose-700 px-4 font-semibold text-white disabled:opacity-60"
      >
        {retrying ? '다시 저장하는 중…' : '다시 시도'}
      </button>
    </div>
  );
}
