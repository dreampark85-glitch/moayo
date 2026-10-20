export function SafetyNotice({ className = '' }: { className?: string }) {
  return (
    <p role="note" className={`rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 ${className}`}>
      MOAYO는 의학적 조언이 아니에요. 운동 중 통증·어지러움 등 이상이 느껴지면 즉시 중단하고 필요하면 전문가와 상담하세요.
    </p>
  );
}
