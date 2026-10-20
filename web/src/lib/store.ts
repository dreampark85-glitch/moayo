// AppProvider 인스턴스마다 하나씩 만드는 상태 컨테이너 (모듈 전역 싱글턴 아님 → SSR 간 상태 공유 없음).
// UI는 이 클래스를 직접 쓰지 않고 AppProvider(Context)를 통해서만 접근한다.
import { reducer } from './reducer.ts';
import type { Action } from './reducer.ts';
import { createInitialState } from './seed.ts';
import type { AppState } from './types.ts';

export class AppStore {
  private state: AppState;
  private readonly listeners = new Set<() => void>();
  private readonly loaded = new Set<string>();

  constructor(initial: AppState) {
    this.state = initial;
  }

  getState = (): AppState => this.state;

  dispatch = (action: Action): void => {
    this.state = reducer(this.state, action);
    this.listeners.forEach((l) => l());
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  isLoaded = (key: string): boolean => this.loaded.has(key);

  markLoaded = (key: string): void => {
    this.loaded.add(key);
  };
}

export function createAppStore(initial: AppState = createInitialState()): AppStore {
  return new AppStore(initial);
}
