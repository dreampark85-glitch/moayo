import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AlarmOverlay } from '@/components/mission/AlarmOverlay';
import { AppProvider } from '@/components/shell/AppProvider';
import { BottomNav } from '@/components/shell/BottomNav';
import { ScreenSkeleton } from '@/components/ui/Skeleton';

export const metadata: Metadata = {
  title: 'MOAYO(모아요)',
  description: '5~15분 짧은 운동 목표를 미션으로 실천하고, 기록으로 다음 운동을 추천받는 프로토타입',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
        >
          본문으로 건너뛰기
        </a>
        {/* 앱 상태(시드)는 실제 오늘 날짜로 만들어지므로 프리렌더 때는 폴백만 보이고 브라우저에서 생성된다 */}
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
      </body>
    </html>
  );
}
