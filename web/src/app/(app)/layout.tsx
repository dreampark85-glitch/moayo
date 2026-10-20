import { Suspense } from 'react';
import { AlarmOverlay } from '@/components/mission/AlarmOverlay';
import { AppProvider } from '@/components/shell/AppProvider';
import { BottomNav } from '@/components/shell/BottomNav';
import { ScreenSkeleton } from '@/components/ui/Skeleton';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    // 앱 상태(시드)는 실제 오늘 날짜로 만들어지므로 프리렌더 때는 폴백만 보이고 브라우저에서 생성된다
    <Suspense
      fallback={
        <div className="mx-auto min-h-dvh w-full max-w-md bg-white shadow-sm">
          <ScreenSkeleton />
        </div>
      }
    >
      <AppProvider>
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white shadow-sm">
          <main id="main" className="flex-1 pb-20">
            {children}
          </main>
          <Suspense fallback={null}>
            <BottomNav />
          </Suspense>
        </div>
        <AlarmOverlay />
      </AppProvider>
    </Suspense>
  );
}
