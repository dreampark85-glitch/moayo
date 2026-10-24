'use client';

// 앱 전역 상태: Context 하나. UI는 { state, api }만 쓰고 reducer/dispatch/seed를 직접 다루지 않는다.
// Supabase 키가 있으면 익명 로그인 후 서버 데이터를 불러오고(hydrate) 쓰기를 서버에 저장한다. 없으면 Mock(시드) 모드.
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { API_DELAY_MS, createApi } from '@/lib/api';
import type { Api, Sync } from '@/lib/api';
import { createEmptyState, createRemoteSync, ensureUserId, loadState } from '@/lib/remote';
import { createAppStore } from '@/lib/store';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { AppState } from '@/lib/types';
import { RetryBanner } from '@/components/ui/RetryBanner';

interface AppContextValue {
  state: AppState;
  api: Api;
  hydrated: boolean;
  isLoaded: (key: string) => boolean;
  markLoaded: (key: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createAppStore(isSupabaseConfigured ? createEmptyState() : undefined));
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  const [sync, setSync] = useState<Sync | undefined>(undefined);
  const [hydrated, setHydrated] = useState(!isSupabaseConfigured);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // 시연 시나리오: Mock 모드에서만 ?scenario=demo (키가 있는 DB 모드는 사용자 데이터를 건드리지 않는다)
    if (isSupabaseConfigured) return;
    if (new URLSearchParams(window.location.search).get('scenario') === 'demo') {
      createApi(store.getState, store.dispatch).loadScenario('demo');
    }
  }, [store]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      try {
        const db = getSupabase();
        const userId = await ensureUserId(db);
        const loaded = await loadState(db, userId);
        if (cancelled) return;
        store.dispatch({ type: 'HYDRATE', state: loaded });
        setSync(createRemoteSync(db, userId));
        setLoadError(null);
        setHydrated(true);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : '알 수 없는 오류');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, attempt]);

  const api = useMemo(() => createApi(store.getState, store.dispatch, sync), [store, sync]);
  const value = useMemo(
    () => ({ state, api, hydrated, isLoaded: store.isLoaded, markLoaded: store.markLoaded }),
    [state, api, hydrated, store],
  );
  return (
    <AppContext.Provider value={value}>
      {loadError && (
        <RetryBanner
          message={`서버에 연결하지 못했어요. (${loadError})`}
          onRetry={() => {
            setLoadError(null);
            setAttempt((n) => n + 1);
          }}
        />
      )}
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp은 AppProvider 안에서만 사용할 수 있어요.');
  return ctx;
}

/**
 * Mock: 읽기 지연(700ms) — 화면 키별 첫 진입 때 false → 700ms 후 true. 이후 재진입은 즉시 true.
 * Supabase: 서버 데이터 로드(hydrate)가 끝나면 true.
 */
export function useScreenReady(key: string): boolean {
  const { hydrated, isLoaded, markLoaded } = useApp();
  const [ready, setReady] = useState(() => isLoaded(key));
  useEffect(() => {
    if (isSupabaseConfigured || ready) return;
    const id = setTimeout(() => {
      markLoaded(key);
      setReady(true);
    }, API_DELAY_MS);
    return () => clearTimeout(id);
  }, [ready, key, markLoaded]);
  return isSupabaseConfigured ? hydrated : ready;
}
