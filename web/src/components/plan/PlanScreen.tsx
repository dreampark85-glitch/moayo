'use client';

import { useMemo, useState } from 'react';
import { useApp, useScreenReady } from '@/components/shell/AppProvider';
import { SafetyNotice } from '@/components/shell/SafetyNotice';
import { ScreenSkeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { selectRecommendations, selectWeeklyReport } from '@/lib/selectors';
import { GoalsPanel } from './GoalsPanel';
import { RecommendationCard } from './RecommendationCard';
import { WeeklyReportPanel } from './WeeklyReportPanel';

const TABS = [
  { id: 'rec', label: '추천' },
  { id: 'report', label: '주간 리포트' },
  { id: 'goals', label: '목표' },
];

export function PlanScreen() {
  const { state, api } = useApp();
  const ready = useScreenReady('plan');
  const [tab, setTab] = useState('rec');
  const recs = useMemo(() => selectRecommendations(state), [state]);
  const report = useMemo(() => selectWeeklyReport(state), [state]);

  if (!ready) return <ScreenSkeleton label="계획을 불러오는 중" />;

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-xl font-bold">계획</h1>
      <SafetyNotice />
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="계획 보기">
        {tab === 'rec' ? (
          <ul className="space-y-3">
            {recs.map((v) => (
              <li key={v.goal.goalId}>
                <RecommendationCard
                  view={v}
                  onApply={async (item) => {
                    await api.applyRecommendation(item);
                  }}
                  onClearPain={(exercise) => api.clearPain(exercise)}
                />
              </li>
            ))}
          </ul>
        ) : null}
        {tab === 'report' ? <WeeklyReportPanel view={report} api={api} /> : null}
        {tab === 'goals' ? <GoalsPanel goals={state.goals} /> : null}
      </Tabs>
    </div>
  );
}
