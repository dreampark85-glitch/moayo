'use client';

// 앱 전역 상태: Context 하나. UI는 { state, api }만 쓰고 reducer/dispatch/seed를 직접 다루지 않는다.
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { API_DELAY_MS, createApi } from '@/lib/api';
import type { Api } from '@/lib/api';
import { createAppStore } from '@/lib/store';
import type { AppState } from '@/lib/types';

interface AppContextValue {
  state: AppState;
  api: Api;
  isLoaded: (key: string) => boolean;
  markLoaded: (key: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createAppStore);
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const api = useMemo(() => createApi(store.getState, store.dispatch), [store]);
  const value = useMemo(
    () => ({ state, api, isLoaded: store.isLoaded, markLoaded: store.markLoaded }),
    [state, api, store],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp은 AppProvider 안에서만 사용할 수 있어요.');
  return ctx;
}

/** Mock 읽기 지연(700ms): 화면 키별 첫 진입 때 false → 700ms 후 true. 이후 재진입은 즉시 true. */
export function useScreenReady(key: string): boolean {
  const { isLoaded, markLoaded } = useApp();
  const [ready, setReady] = useState(() => isLoaded(key));
  useEffect(() => {
    if (ready) return;
    const id = setTimeout(() => {
      markLoaded(key);
      setReady(true);
    }, API_DELAY_MS);
    return () => clearTimeout(id);
  }, [ready, key, markLoaded]);
  return ready;
}
