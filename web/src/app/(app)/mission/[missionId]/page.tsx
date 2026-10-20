import { Suspense } from 'react';
import { MissionScreen } from '@/components/mission/MissionScreen';
import { listStaticMissionIds } from '@/lib/api';

// 오늘 예정 미션을 빌드 시 정적 생성하고, 그 외 id(과거·미래 미션)는 요청 시 클라이언트에서 해석한다.
export function generateStaticParams() {
  return listStaticMissionIds().map((missionId) => ({ missionId }));
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <MissionScreen />
    </Suspense>
  );
}
