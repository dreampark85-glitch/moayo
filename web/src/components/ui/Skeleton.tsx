export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-slate-200 ${className}`} />;
}

/** 700ms Mock 읽기 동안 보여주는 화면 스켈레톤 */
export function ScreenSkeleton({ label = '불러오는 중' }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-4 p-4">
      <span className="sr-only">{label}…</span>
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}
