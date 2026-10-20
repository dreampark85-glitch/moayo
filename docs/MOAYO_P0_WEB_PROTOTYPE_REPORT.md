# MOAYO P0 웹 프로토타입 결과 보고서

- 작성일: 2026-10-20. 앱의 '오늘'은 실제 기기의 당일 날짜다(처음에는 2026-03-04로 고정했으나 사용자 요청으로 변경).
- 대상: `C:\AI_SERVICE\moayo\web` (Next.js 16.4.2 App Router, React 19.3.0, TypeScript strict, Tailwind 4)
- 기준 문서: `docs/MOAYO_PRD_v0.1.md`, 계획 `.omc/plans/moayo-p0-web-prototype-plan.md`, 스펙 `.omc/specs/deep-interview-moayo-p0-web-prototype.md`
- 이 보고서는 구현된 코드를 직접 읽고 검증 명령을 실제로 실행한 결과만 적었다. 브라우저에서 화면을 직접 조작해 본 검증은 하지 못했다(§12).

## 1. 전체 파일 구조

```
web/
├─ package.json            # scripts: dev/build/start/lint/verify:domain, @supabase/supabase-js 제거
├─ tsconfig.json           # strict, allowImportingTsExtensions: true
├─ next.config.ts          # cacheComponents, partialPrefetching (기존 설정 유지)
├─ scripts/
│  └─ verify-domain.ts     # 도메인 검증 37개 체크 (Node 타입 스트리핑으로 실행)
└─ src/
   ├─ app/
   │  ├─ layout.tsx, globals.css, favicon.ico
   │  ├─ page.tsx                       # /
   │  ├─ onboarding/page.tsx            # /onboarding
   │  ├─ goals/new/page.tsx             # /goals/new
   │  ├─ mission/[missionId]/page.tsx   # /mission/[missionId]
   │  ├─ records/page.tsx               # /records
   │  ├─ plan/page.tsx                  # /plan
   │  └─ my/page.tsx                    # /my
   ├─ components/
   │  ├─ shell/    AppProvider.tsx, BottomNav.tsx, SafetyNotice.tsx, MyScreen.tsx
   │  ├─ ui/       Skeleton.tsx, RetryBanner.tsx, LiveRegion.tsx, Modal.tsx, Tabs.tsx, Field.tsx
   │  ├─ home/     HomeScreen.tsx
   │  ├─ mission/  MissionScreen.tsx, AlarmOverlay.tsx, labels.ts
   │  ├─ goal/     OnboardingScreen.tsx, GoalNewScreen.tsx
   │  ├─ records/  RecordsScreen.tsx, Heatmap.tsx, DayDetailModal.tsx
   │  └─ plan/     PlanScreen.tsx, RecommendationCard.tsx, WeeklyReportPanel.tsx, GoalsPanel.tsx, labels.ts
   └─ lib/
      types.ts, date.ts, templates.ts, missions.ts, seed.ts, reducer.ts, store.ts,
      api.ts, selectors.ts, recommendation.ts, streak.ts, report.ts, onboarding.ts, alarm.ts
```

- 이전 프로젝트(챌린지·루틴) 파일과 `web/supabase/habits.sql`은 모두 삭제했다. `src`에는 해당 잔재가 없다.
- `app/` 아래 `page.tsx`는 PRD IA에 맞춘 7개뿐이다. `route.ts`와 `app/api`는 없다(§8).

## 2. 각 파일의 역할

### app/
| 파일 | 역할 |
|---|---|
| `layout.tsx` | 서버 컴포넌트. `<html lang="ko">`, 본문 건너뛰기 링크, Suspense로 감싼 `AppProvider`(시드가 실제 오늘 날짜로 만들어져 브라우저에서 생성됨), 모바일 폭(`max-w-md`) 컨테이너, `BottomNav`(Suspense), 전역 `AlarmOverlay` |
| `globals.css` | Tailwind import, 기본 폰트, `:focus-visible` 윤곽선, `prefers-reduced-motion`, 히트맵 `.heat-0`~`.heat-4`(색 + 빗금 패턴) |
| `page.tsx` 외 6개 | 화면 컴포넌트를 렌더링하는 얇은 래퍼. `mission/[missionId]/page.tsx`만 `generateStaticParams`(빌드 시점 날짜의 오늘 예정 미션 id, `api.listStaticMissionIds`)와 `Suspense`를 가진다 |

### lib/ (도메인·데이터 계층)
| 파일 | 역할 |
|---|---|
| `types.ts` | PRD 10장 엔티티(User, Goal, Mission, PracticeRecord, Recommendation, Streak), `AppState`, `AlarmState`, `RecommendationResult`, 입력 타입. 인증 방식은 `auto`/`manual`/`simulated` |
| `date.ts` | `today()`(실제 당일 로컬 날짜)와 날짜 유틸. 앱의 유일한 날짜 원천. 검증 스크립트용 `setToday()` 포함 |
| `templates.ts` | 목표 템플릿 11종, 단위·부위 라벨 |
| `missions.ts` | `missionIdOf`(`m-{goalId}-{YYYYMMDD}`), `isScheduled`, `buildMissions` |
| `seed.ts` | 시드 목표 8개와 '오늘' 기준 최근 4주 기록(§6), `createInitialState()`, `seedTodayMissionIds()` |
| `reducer.ts` | 순수 reducer와 `Action` 타입 |
| `store.ts` | `AppStore` 클래스(Provider 인스턴스마다 1개), `createAppStore()` |
| `api.ts` | Mock API(§7), 알림 시뮬레이션 동기 함수, `validateGoalInput`, `listStaticMissionIds` |
| `selectors.ts` | 화면용 순수 읽기 함수(오늘 미션, 다음 알림, 스트릭, 히트맵, 일별 상세, 추천, 주간 리포트) |
| `recommendation.ts` | 추천 규칙 `recommend()`와 증감 함수(§4) |
| `streak.ts` | `computeStreak()`(§5) |
| `report.ts` | `weeklyReport()` 주간 지표 |
| `onboarding.ts` | `suggestFirstGoal()` 온보딩 3문항 → 첫 목표 |
| `alarm.ts` | 알림 시뮬레이션 순수 규칙(스누즈·재노출·타임아웃) |

### components/
| 파일 | 역할 |
|---|---|
| `shell/AppProvider.tsx` | Context 하나. `useSyncExternalStore`로 스토어를 구독하고 `{ state, api, isLoaded, markLoaded }`를 제공. `useScreenReady(key)`는 화면 키별 첫 진입 시 700ms 동안 false |
| `shell/BottomNav.tsx` | 하단 내비(홈/기록/계획/마이), `/mission*`에서는 숨김 |
| `shell/SafetyNotice.tsx` | 안전 고지 문구 |
| `shell/MyScreen.tsx` | 마이 화면 |
| `ui/*` | Skeleton, RetryBanner, LiveRegion, Modal(포커스 트랩), Tabs(화살표 키 이동), Field(라벨·오류 연결) |
| `home/HomeScreen.tsx` | 홈 |
| `mission/AlarmOverlay.tsx` | 알림 시뮬레이션 풀스크린 오버레이 |
| `mission/MissionScreen.tsx` | 미션 수행(카운트·걸음·타이머) → 회고 → 완료 |
| `goal/*` | 온보딩, 목표 생성 |
| `records/*` | 기록 탭, 히트맵, 일별 상세 모달 |
| `plan/*` | 계획 탭, 추천 카드, 주간 리포트, 목표 목록 |

## 3. PRD P0 기능 ID별 구현 위치

| ID | 구현 위치 | 구현 내용 |
|---|---|---|
| G-01 목표 생성 | `components/goal/GoalNewScreen.tsx`, `lib/api.ts`(`createGoal`, `validateGoalInput`), `lib/missions.ts`(`buildMissions`) | 운동 종류·분량·단위·요일·시각·기간(1~4주)·부위 입력. 템플릿에서 시작하면 템플릿 선택 후 만들기 2번 조작으로 생성. 분량은 단위별 최소/최대(`MIN_AMOUNT`/`MAX_AMOUNT`) 검증 |
| G-02 템플릿 | `lib/templates.ts`(`TEMPLATES` 11종), `GoalNewScreen.tsx` 템플릿 목록 | 아침 5분 스트레칭, 퇴근 후 10분 하체, 점심 1000보 등 11종 |
| G-03 온보딩 진단 | `components/goal/OnboardingScreen.tsx`, `lib/onboarding.ts`(`suggestFirstGoal`), `api.completeOnboarding` | 운동 빈도·선호 시간·가능 장소 3문항 → 첫 목표 제안 → 수락 또는 직접 수정 |
| M-01 미션 알림 | `lib/alarm.ts`, `lib/api.ts`(`alarmTrigger`/`alarmSnooze`/`alarmTick`/`alarmStart`), `components/mission/AlarmOverlay.tsx`, `HomeScreen.tsx`('지금 알림 발생(시연)' 버튼) | **대체:** 실제 푸시 없이 앱 안 풀스크린 알림 시뮬레이션 |
| M-02 동작 카운트 | `components/mission/MissionScreen.tsx`(count 단계) | **대체:** 탭 +1 수동 카운트, 기록 인증방식 `manual`('수동 카운트') |
| M-03 걸음 수 | `MissionScreen.tsx`(steps 단계) | **대체:** '+100보' 시뮬레이션 입력, 인증방식 `simulated`('시뮬레이션') |
| M-04 타이머 | `MissionScreen.tsx`(timer 단계, `visibilitychange` 리스너) | 카운트다운, 시작/일시정지/재개, 화면 이탈 시 일시정지. 인증방식 `auto` |
| R-01 자동 기록 | `api.saveRecord` → `reducer.ts`의 `SAVE_RECORD` | 목표 연결(운동 종류)·분량·소요 시간·인증 방식·예정일·완료 일시 저장 |
| R-02 체감 난이도 | `MissionScreen.tsx` 회고 단계(`role="radiogroup"` 라디오 3개 + 메모) | 쉬워요/적당해요/힘들어요. 선택해야 저장 버튼이 활성화됨 |
| R-03 캘린더 히트맵 | `components/records/Heatmap.tsx`, `RecordsScreen.tsx`, `DayDetailModal.tsx`, `selectors.selectHeatmap`/`selectDayDetail` | 월간 히트맵, 날짜 선택 시 상세 모달, 주간 탭 |
| R-04 스트릭 | `lib/streak.ts`, `selectors.selectStreak`, `HomeScreen.tsx`/`RecordsScreen.tsx`/`MissionScreen.tsx`에서 표시 | 목표 요일 기준(§5), 월 1회 보호권 |
| P-01 다음 운동 추천 | `lib/recommendation.ts`, `selectors.selectRecommendations`, `components/plan/RecommendationCard.tsx`, `api.applyRecommendation` | 수락/수정/건너뛰기 |
| P-02 주간 리포트 | `lib/report.ts`, `selectors.selectWeeklyReport`, `components/plan/WeeklyReportPanel.tsx` | 실천 횟수·총 시간·달성률·지난주 대비·다음 주 계획 |
| P-03 다음 주 확정 | `api.confirmNextWeek`, `WeeklyReportPanel.tsx`('다음 주 계획 1탭 확정') | 목표량·알림 시각 갱신, 미래 미션 재생성 |

### 웹 전환으로 대체·제외한 항목과 이유
| 항목 | 처리 | 이유 |
|---|---|---|
| M-01 실제 푸시·±1분 발송 신뢰성 | 앱 내 시뮬레이션으로 대체. 스누즈는 최대 2회, 10분 간격이며 시연에서는 `SPEED=60` 배속으로 실제 10초 | 웹 프로토타입에 푸시 인프라가 없음(스펙 D1) |
| M-02 카메라 포즈 인식 | 제외, 수동 탭 카운트로 대체 | 온디바이스 포즈 인식은 웹 범위 밖(스펙 D2) |
| M-03 HealthKit / Health Connect | 제외, 시뮬레이션 입력으로 대체 | 브라우저 표준 걸음 수 API 없음(스펙 D3) |
| 데이터 지속성 | localStorage 미사용, 새로고침 시 시드로 초기화 | 과제 조건(스펙 D5) |
| M-05 사진 인증, M-06 미니 미션, M-07 강도 모드 | 미구현. `MissionType`에 `photo`/`mini` 타입만 정의. 미니 미션은 추천 `extras`에 '다음 버전에서 제공' 문구만 있음 | P1 범위 |
| 구독·결제, 친구 그룹, 공유 카드, 헬스 연동 | 제외. 마이 화면에 '준비 중' 비활성 행만 표시 | P2·범위 외 |
| P-02 '매주 일요일 저녁' 자동 노출 | 구현하지 않음. 계획 탭의 '주간 리포트' 탭에서 항상 열람 | 프로토타입에 시각 기반 노출 로직이 없음 |
| 음성 카운트(PRD 11장 접근성) | 구현하지 않음 | 계획 범위 외 |

## 4. 다음 운동 추천 규칙

- **구현 위치:** `src/lib/recommendation.ts`의 `recommend()`(순수 함수). 화면용 조립은 `selectors.selectRecommendations`, UI는 `components/plan/RecommendationCard.tsx`. `react`·`reducer`·`api`·`store`를 import하지 않는다(§8).
- **기준 단위:** 해당 목표의 기록 최신 3건(`done`과 `missed` 포함).

### 우선순위 (첫 번째로 해당하는 규칙 하나만 적용)
| 순서 | RuleId | 조건 | 결과 |
|---|---|---|---|
| 0 | `no_data` | 기록 0건 | 현재 목표로 시작하라는 안내 |
| 1 | `pain_stop` | 최근 3건 중 메모가 `/통증\|아파\|아픔\|아프/`에 매칭되고 `painClearedAt[운동]` 이후 기록 | `stop=true`, 추천 중단 + 휴식 권고 |
| 2 | `missed_down` | 기록 3건 이상: 최근 3건 중 `missed` 2건 이상 / 3건 미만: 최근 1건이 `missed` | 분량 −30% |
| 3 | `hard_down` | 기록 3건 이상: '힘들어요' 2건 이상 / 3건 미만: 최근 1건이 '힘들어요' | 분량 −20% |
| 4 | `insufficient_data` | 위에 해당 없고 기록 3건 미만 | 분량 유지, '데이터 더 모으는 중' 안내 |
| 5 | `easy_up` | 최근 3건 모두 `done` + '쉬워요' 2건 이상 | 분량 +20%(상한 적용) |
| 6 | `ok_hold` | 최근 3건 모두 `done` + '힘들어요' 0건 + '쉬워요' 2건 미만 | 분량 유지 + 운동 종류 추가 제안. 수정 화면에서 +10% 선택 가능(`plus10Amount`) |
| 7 | `four_week_new` | 위 어디에도 해당하지 않고 같은 운동이 4주 지속 | 유지 + 새 운동/챌린지 제안 |
| 8 | `none` | 그 외 | 현재 분량 유지 |

- **4주 지속:** 운동 종류 기준(`isFourWeekStreak`). `[today−27, today]`를 7일씩 4구간으로 나눠 모든 구간에 같은 운동의 `done` 기록이 있으면 성립한다. 규칙 2·3·5·6의 결과에는 `extras`로 부가 메시지를 덧붙이고, 규칙이 `none`일 때만 `four_week_new`가 단독 결과가 된다.

### 증감식
- 단위 `u`: 횟수 1회, 시간 1분, 걸음 100보 (`UNIT_STEP`)
- 최소 분량: 횟수 5, 시간 5분, 걸음 500 (`MIN_AMOUNT`). 최대는 시간 15분만 있음 (`MAX_AMOUNT`)
- 증가: `inc = floor(base × 0.2 / u) × u`, 결과 `min(base + inc, 최대)` (`increaseAmount`)
- 감소: `dec = ceil(base × r / u) × u`, 결과 `max(base − dec, 최소)` (`decreaseAmount`). r은 0.3(미실천) 또는 0.2(힘들어요)
- 예: 스쿼트 20회 → 24회, 런지 15회 → 10회, 점핑잭 30회 → 24회, 걷기 1000보 증가 시 1200보
- 결과가 현재 분량과 같으면 `atCap`(상한) 또는 `atMin`(최소) 플래그를 켜고, '올려볼까요?' 대신 상한·최소 도달 문구를 보여 준다.

### 안전 가드레일 (코드 위치)
| 가드레일 | 구현 |
|---|---|
| 1회 증가폭 최대 +20% | `increaseAmount`가 비율을 `MAX_INCREASE_RATIO`(0.2)로 제한. 수정 모달의 입력 상한도 `increaseAmount(goal.target, goal.unit)`로 계산(`RecommendationCard.tsx`) |
| 시간형 상한 15분 | `MAX_AMOUNT.min = 15` |
| 최소 분량 | `MIN_AMOUNT`: 감소가 최소 아래로 내려가지 않음 |
| 통증 메모 시 해당 운동 추천 중단 + 휴식 권고 | `pain_stop` 규칙(최우선). 기록 3건 미만이어도 항상 적용. 계획 탭의 '다시 시작' 버튼(`api.clearPain`)으로만 해제 |
| 같은 부위 연속일 배정 경고 | `bodyPartWarnings()`: 하체·상체·코어만 대상. 앞으로 14일 안의 예정일 전/후일에 같은 부위의 다른 활성 목표가 있으면 모든 추천 결과에 `warnings` 추가 |
| 안전 고지 | `SafetyNotice.tsx`('의학적 조언이 아니에요…')를 온보딩·목표 생성·홈·미션·계획·마이 화면에서 사용 |

- 시간대 변경 제안: `missed_down`일 때 `selectors.selectRecommendations`가 `suggestedTime`(목표 시각 1시간 앞당김, 예: 21:00 → 20:00)을 만든다.

## 5. 스트릭 계산 기준과 구현 위치

- **구현 위치:** `src/lib/streak.ts`의 `computeStreak(goals, records, today)`(순수 함수). 화면용은 `selectors.selectStreak`.
- **기준:** 목표 요일 기준(PRD R-04, 스펙 D8). 사용자 단위로 날짜를 본다.
  - 그날 예정된 목표가 있으면 '예정일'이다. 예정 목표 중 하나라도 `done`이면 done일, `done`이 없으면(미실천 기록 또는 기록 없음) missed일이다.
  - 예정 목표가 없는 날은 건너뛴다(스트릭에 영향 없음).
  - 오늘이 예정일인데 `done`도 `missed` 기록도 없으면 오늘은 건너뛴다.
  - 오늘부터 과거로 세어 done일마다 +1, missed일을 만나면 중단한다.
- **보호권:** 달력 월당 1회. 해당 월의 첫 missed일은 흡수(+0, 중단 없음)하고 `protectionUsedOn`에 날짜를 기록한다. 같은 달 두 번째 missed일에서 중단한다. `protectionLeft`는 오늘이 속한 월의 사용 여부에서 매번 계산하며 따로 저장하지 않는다.
- **longest:** 과거에서 오늘로 같은 규칙을 적용해 계산한다.
- **시드 기준 결과:** 시드는 최근 27일이 모두 예정일이고 모두 완료라서 `current = 27`, `longest = 27`, `protectionUsedOn = []`, `protectionLeft = 1`이다. 오늘 미션을 완료하면 28, 오늘 미실천이 되면 보호권(`protectionLeft = 0`)으로 흡수되어 27이 유지된다. 보호권 흡수와 같은 달 두 번째 누락 중단은 `scripts/verify-domain.ts`의 픽스처로 검증한다.

## 6. Mock 데이터 위치와 구성

- **위치:** 템플릿 `src/lib/templates.ts`, 시드 `src/lib/seed.ts`. 난수는 쓰지 않는다. '오늘'은 `src/lib/date.ts`의 `today()`(실제 당일 날짜)이고, 시드는 `createInitialState()`를 호출할 때마다 그 날짜를 기준으로 새로 만든다.
- **템플릿 11종:** 아침 5분 스트레칭, 퇴근 후 10분 하체, 점심 1000보, 스쿼트 20회, 점핑잭 30회, 플랭크 5분, 런지 15회, 푸시업 10회, 저녁 10분 코어, 잠들기 전 5분 스트레칭, 요가 8분.
- **시드 사용자:** `u-1`, 닉네임 '지은', 일반 알림, 무료 구독 상태.
- **기간:** 시드 목표는 오늘−27일부터 오늘+42일까지다. 기록은 목표 시작일부터 어제까지 예정일마다 1건이고, 오늘 이후 기록은 없다.
- **예외 기록은 날짜가 아니라 순번으로 지정한다.** 0이 가장 최근 예정일이다. 어떤 요일에 열어도 규칙 8종이 같게 발동한다. 기본값은 완료·'적당해요'다.

| 목표 | 단위·목표량·요일·시각 | 예외 기록(순번) | 기대 추천 |
|---|---|---|---|
| 푸시업 `g-pushup` | 10회, 월·목 07:30 | 0: '힘들어요' + 메모 '손목 통증이 있었어요', 2: 미실천 | `pain_stop` |
| 런지 `g-lunge` | 15회, 화·목 21:00 | 0·2: 미실천 | `missed_down` → 10회 |
| 점핑잭 `g-jumpingjack` | 30회, 목·토 20:00 | 0·1: '힘들어요' | `hard_down` → 24회 |
| 스쿼트 `g-squat` | 20회, 월·수·금 22:00 | 0·1: '쉬워요' | `easy_up` → 24회 + 하체 연속일 경고 |
| 플랭크 `g-plank` | 10분, 일·수 21:30 | 없음(모두 '적당해요') | `ok_hold` (+10% 값 11분) |
| 스트레칭 `g-stretch` | 5분, 월~금 07:00 | 0: '쉬워요', 1: '적당해요', 2: '힘들어요' | `four_week_new` |
| 걷기 `g-walk` | 1000보, 월·수·금 12:30 | 시작일을 최근 예정일 2번 전으로 잡아 기록이 2건 | `insufficient_data` |
| 요가 `g-yoga` | 8분, 토·일 09:00, 시작일 = 오늘 | 기록 없음 | `no_data` |

- 인증 방식은 단위에 따라 횟수형 `manual`, 시간형 `auto`, 걸음형 `simulated`다. 미션은 `buildMissions`로 각 목표 기간 전체에 미리 만들어 둔다.
- 요일별 오늘 미션은 월(스쿼트·푸시업·스트레칭·걷기), 화(런지·스트레칭), 수(스쿼트·플랭크·스트레칭·걷기), 목(런지·푸시업·점핑잭·스트레칭), 금(스쿼트·스트레칭·걷기), 토(점핑잭·요가), 일(플랭크·요가)이며 항상 2개 이상이다.
- 시드 목표를 8개로 둔 것은 PRD 12장의 무료 동시 목표 2개 한도와 다르다. 추천 규칙 8종을 시드로 모두 시연하기 위한 선택이며, 한도는 구독이 범위 밖이라 강제하지 않는다.

## 7. Mock API 위치와 성공·실패를 만드는 방법

- **위치:** `src/lib/api.ts`의 `createApi(getState, dispatch)`. `AppProvider`가 `useMemo`로 한 번 만들어 Context의 `api`로 제공한다.
- **지연:** 영속 쓰기 함수(`createGoal`, `completeOnboarding`, `saveRecord`, `markMissed`, `applyRecommendation`, `confirmNextWeek`, `clearPain`)는 `API_DELAY_MS = 700`ms 후 응답한다. 읽기는 `selectors`(동기 함수)로 하되, 각 화면은 `useScreenReady(key)`로 화면 첫 진입 시 700ms 동안 스켈레톤(`ScreenSkeleton`)을 보여 준다. 같은 화면 키는 이후 재진입 때 바로 표시된다.
- **지연이 없는 것(스펙 D13):** 미션 진행 중 탭 카운트·걸음 +100·타이머와 알림 시뮬레이션 동작(`alarmTrigger`/`alarmSnooze`/`alarmTick`/`alarmStart`)은 로컬 처리다. 알림 3번째 타임아웃으로 만드는 미실천 기록(`markMissed`)만 700ms 지연이 있다.
- **성공:** 입력이 유효하면 700ms 후 상태가 갱신되고 결과를 반환한다. 목표 생성은 `validateGoalInput`(운동 종류 필수, 요일 1개 이상, `HH:mm` 시각, 단위별 최소·최대)을 통과해야 한다.
- **실패를 만드는 방법:** 회고 메모에 `FAIL_TRIGGER = '실패테스트'`가 포함되면 `saveRecord`가 700ms 후 `SaveFailedError`를 던진다. 이때 상태는 바뀌지 않는다(원자적). `MissionScreen.tsx`는 `RetryBanner`(`role="alert"`, `aria-live="assertive"`)와 '다시 시도' 버튼을 보여 주고, 입력한 카운트와 메모는 유지한다. 메모에서 해당 문구를 지우고 다시 저장하면 성공한다.
- **그 외 오류:** 존재하지 않는 미션·목표 id나 목표 입력 검증 실패 시 `Error`를 던진다.

## 8. 실제 네트워크·DB·localStorage를 사용하지 않았다는 근거 (grep)

```
$ grep -rEn "fetch\(|localStorage|sessionStorage|use server|@supabase" src scripts package.json
(일치하는 줄 없음, rc=1)

$ find src -name route.ts -o -path "*app/api*"
(출력 없음)

$ find src/app -name page.tsx
src/app/goals/new/page.tsx
src/app/mission/[missionId]/page.tsx
src/app/my/page.tsx
src/app/onboarding/page.tsx
src/app/page.tsx
src/app/plan/page.tsx
src/app/records/page.tsx

$ grep -rn "lib/store\|lib/reducer\|lib/seed" src/components src/app
src/components/shell/AppProvider.tsx:8:import { createAppStore } from '@/lib/store';
(reducer·seed를 직접 import하는 components/app 파일 없음. 스토어는 AppProvider만 import)

$ grep -nE "from ['\"](react|\./reducer|\./api|\./store)" src/lib/{recommendation,streak,report,date,onboarding,alarm}.ts
(일치하는 줄 없음, rc=1)

$ grep -rnE ": any|<any>|as any" src scripts
(일치하는 줄 없음)
```

- 외부 호출·서버 코드·DB는 쓰지 않았다. 데이터는 `AppStore`의 메모리 상태(`AppProvider` 인스턴스마다 하나)에만 있고, 새로고침하면 `createInitialState()`로 돌아간다.
- `Date.now()`는 알림 deadline(`api.ts`, `AlarmOverlay.tsx`)과 타이머 남은 시간 계산(`MissionScreen.tsx`)에만 쓰인다. 앱의 '오늘'은 `today()` 하나로만 구한다.
- `package.json`에서 `@supabase/supabase-js`를 제거했고 `src`에 supabase 참조는 없다.

## 9. 접근성 구현 위치

| 파일 | 속성·동작 |
|---|---|
| `app/layout.tsx` | `<html lang="ko">`, '본문으로 건너뛰기' 링크(`href="#main"`, 포커스 시 표시), `<main id="main">` |
| `app/globals.css` | `:focus-visible` 3px 윤곽선, `prefers-reduced-motion`에서 애니메이션 최소화, 히트맵 `.heat-0~4`(색 + 빗금 패턴) |
| `shell/BottomNav.tsx` | `<nav aria-label="주요 메뉴">`, 현재 탭 `aria-current="page"` + 밑줄(색 외 표시), 항목 `min-h-14` |
| `shell/SafetyNotice.tsx` | `role="note"` |
| `ui/Skeleton.tsx` | `role="status"`, `aria-busy="true"`, 스크린리더용 '불러오는 중…'(`sr-only`) |
| `ui/RetryBanner.tsx` | `role="alert"`, `aria-live="assertive"`, 버튼 `min-h-11` |
| `ui/LiveRegion.tsx` | `aria-live="polite|assertive"`, `aria-atomic="true"` |
| `ui/Modal.tsx` | `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Escape`로 닫기, Tab 포커스 트랩, 열 때 포커스 이동·닫을 때 복귀 |
| `ui/Tabs.tsx` | `role="tablist"`·`"tab"`·`"tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby`, roving `tabIndex`, ←/→/Home/End 이동 |
| `ui/Field.tsx` | `aria-describedby`, `aria-invalid`, 오류 문구 `aria-live` |
| `mission/AlarmOverlay.tsx` | `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`, `aria-live`/`aria-atomic`(카운트다운 안내는 5초 단위 갱신), Tab 포커스 트랩, `Escape`는 `preventDefault()`만 하고 닫지 않음(스킵 불가), 열 때 '미션 시작'에 포커스·닫을 때 복귀 |
| `mission/MissionScreen.tsx` | 큰 숫자 `text-[clamp(6rem,32vw,9rem)]`, `role="status"`와 `aria-live`로 숫자 변화 안내, `role="progressbar"` + `aria-valuemin/max/now`, `role="timer"`, 난이도 `role="radiogroup"`(네이티브 `input type="radio"`), 저장 상태·오류 `aria-live`, 장식 요소 `aria-hidden` |
| `records/Heatmap.tsx` | `role="grid"`·`"row"`·`"columnheader"`·`"gridcell"`, 셀 `aria-label`, roving `tabIndex`, ←/→/↑/↓/Home/End 이동. 셀에 날짜와 'N회'를 글자로 표시하고 `.heat-N` 클래스를 적용. 범례도 색 + 패턴 |
| `records/RecordsScreen.tsx`, `DayDetailModal.tsx` | `aria-live`(월 이동 안내), 일별 상세는 `Modal` 사용 |
| `goal/OnboardingScreen.tsx` | 질문마다 `<fieldset>`/`<legend>`, 네이티브 `input type="radio"`, `aria-labelledby`, 오류 `role="alert"`, 저장 상태 `aria-live` |
| `goal/GoalNewScreen.tsx` | 요일 `<fieldset>`/`<legend>` + 체크박스, `aria-required`, `aria-pressed`(템플릿 선택), `aria-live`, 오류 `role="alert"` |
| `plan/RecommendationCard.tsx`, `WeeklyReportPanel.tsx` | `role="alert"`와 `aria-live`로 응답·저장 결과 안내, 수정은 `Modal`, `aria-required` |
| `shell/MyScreen.tsx` | 비활성 항목 `aria-disabled`, 영역 `aria-labelledby` |

## 10. `npm run lint` 실제 출력

```
> web@0.1.0 lint
> eslint

lint exit=0
```

(마지막 줄 `lint exit=0`은 출력을 파일로 저장하며 종료 코드를 덧붙인 것이다. eslint는 경고·오류를 출력하지 않았다.)

## 11. `npm run build` 실제 출력 (Route 목록 포함)

```

> web@0.1.0 build
> next build

▲ Next.js 16.4.2 (Turbopack)
- Environments: .env.local
✓ Running next.config.ts took 34ms
- Cache Components enabled
- Partial Prefetching enabled

  Creating an optimized production build ...
✓ Compiled successfully in 379ms
  Running TypeScript ...
  Finished TypeScript in 1394ms ...
  Collecting page data using 11 workers ...
  Generating static pages using 11 workers (0/12) ...
  Generating static pages using 11 workers (3/12) 
  Generating static pages using 11 workers (6/12) 
  Generating static pages using 11 workers (9/12) 
✓ Generating static pages using 11 workers (12/12) in 1263ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /goals/new
├   /mission/[missionId]
│ ├ ◐ /mission/[missionId]
│ ├ ○ /mission/m-g-lunge-20261020
│ └ ○ /mission/m-g-stretch-20261020
├ ○ /my
├ ○ /onboarding
├ ○ /plan
└ ○ /records


○  (Static)             prerendered as static content
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content

build exit=0
```

(마지막 줄 `build exit=0`은 출력을 파일로 저장하며 종료 코드를 덧붙인 것이다. 미션 경로 예시는 빌드한 날짜의 오늘 미션이다.)

도메인 검증 `npm run verify:domain`의 실제 출력은 다음과 같다(Node의 `MODULE_TYPELESS_PACKAGE_JSON` 경고 4줄은 생략). '오늘'을 연속 7일(모든 요일)과 실제 오늘 날짜로 바꿔 가며, 기준일마다 같은 28개 체크를 돌린다. 체크 내용은 시드 규칙 8종, 증감식 경계, 우선순위, 신규 사용자, 4주 윈도우, 스트릭, 주간 리포트, API 지연·실패·원자성, 알림 스누즈·타임아웃, 템플릿·온보딩이다.

```

> web@0.1.0 verify:domain
> node scripts/verify-domain.ts

실제 오늘 = 2026-10-20 (화), 검증 기준일 8개
  2026-03-02(월): 28 checks
  2026-03-03(화): 28 checks
  2026-03-04(수): 28 checks
  2026-03-05(목): 28 checks
  2026-03-06(금): 28 checks
  2026-03-07(토): 28 checks
  2026-03-08(일): 28 checks
  2026-10-20(화): 28 checks

226 checks passed
```

## 12. 한계와 미검증 항목, 계획과 달라진 점

- **브라우저 조작 미검증:** `next start`로 7개 라우트와 존재하지 않는 미션 id(`/mission/unknown-id`)가 모두 HTTP 200을 반환하는 것까지만 확인했다. 클릭·키보드 조작, 스누즈 타이머, 타이머 일시정지, 스크린리더 동작은 이 세션에서 직접 확인하지 못했다. §9의 접근성 항목은 코드에 들어 있는 속성을 읽어 정리한 것이며, 계획 §7의 '키보드만으로 전체 흐름 완주' 수동 검증은 아직 하지 않았다.
- **Ralph 사용 못 함:** 승인된 실행 방식은 ralph였지만, `omc ralph verify` 기준선 게이트가 'Already inside a Claude Code session' 오류로 실행되지 않아 사용자 결정에 따라 일반 구현으로 진행했다. 기준선 대비 비교, 독립 리뷰어 검증, deslop 단계는 수행하지 않았다.
- **상태 관리 설계 변경:** 계획 v2는 `useReducer`를 적었지만, React 컴파일러 린트(`react-hooks/refs`, `react-hooks/immutability`)가 렌더 중 ref·가변 객체 접근을 막아서 `lib/store.ts`의 `AppStore`를 `useSyncExternalStore`로 구독하는 방식으로 바꿨다. Context는 하나이고 UI는 `api`와 selector로만 접근한다.
- **`.ts` 확장자 import:** `lib/`는 검증 스크립트를 Node 타입 스트리핑으로 실행하려고 상대 import에 `.ts` 확장자를 쓰고, `tsconfig.json`에 `allowImportingTsExtensions: true`를 켰다. `npm run verify:domain` 실행 시 Node가 `MODULE_TYPELESS_PACKAGE_JSON` 경고를 출력한다(`package.json`에 `"type"`이 없기 때문이며 결과에는 영향 없음).
- **계획에 없던 추가:** 타이머 화면의 '시연: 1분 건너뛰기' 버튼, 목표 생성의 '템플릿 없이 직접 입력', 기록 월 이동 범위 제한(현재 월 ~ 3개월 전), 회고 난이도 기본 미선택(선택해야 저장 가능)은 구현 과정에서 추가됐다.
- **'오늘' 날짜 변경:** 처음 스펙(D7)은 '오늘'을 2026-03-04로 고정했지만 사용자 요청으로 실제 당일 날짜를 쓰도록 바꿨다. 시드를 '오늘' 기준 상대 날짜로 다시 만들었고, `cacheComponents`가 프리렌더 중 `new Date()`를 막아서 `layout.tsx`에서 `AppProvider`를 Suspense로 감쌌다(프리렌더 HTML은 스켈레톤 폴백만 보이고 앱은 브라우저에서 만들어진다). 자정을 넘겨 열어 둔 탭은 새로고침하기 전까지 이전 날짜를 유지한다.
- **알려진 한계:** 미션 화면에서 새로고침하면 시드 상태로 돌아가므로 진행 중 카운트와 방금 저장한 기록이 사라진다(스펙 D5). 읽기 지연 700ms는 화면 키별 첫 진입에만 적용된다.
- **환경 파일:** 빌드 출력의 `Environments: .env.local`은 Next.js가 파일 존재를 알려 주는 것이며, 이 작업에서 해당 파일을 읽지 않았다.
- **커밋:** 하지 않았다. `web/` 전체가 여전히 untracked다.
