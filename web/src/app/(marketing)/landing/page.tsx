import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'MOAYO(모아요) — 5분 운동 미션',
  description: '알림을 끄려면 운동 미션을 해내세요. 기록은 자동으로 쌓이고, 다음 운동은 추천해 드려요.',
};

const WEEK = [
  { day: '월', value: 70 },
  { day: '화', value: 40 },
  { day: '수', value: 100 },
  { day: '목', value: 30 },
  { day: '금', value: 60 },
  { day: '토', value: 90 },
  { day: '일', value: 35 },
];

const EXERCISES = [
  { emoji: '🦵', label: '스쿼트', tone: 'bg-rose-50' },
  { emoji: '🚶', label: '걷기', tone: 'bg-sky-50' },
  { emoji: '🧘', label: '플랭크', tone: 'bg-violet-50' },
  { emoji: '🤸', label: '스트레칭', tone: 'bg-amber-50' },
];

const FEATURES = [
  { emoji: '⏰', title: '미션 알림', desc: '스쿼트·걸음 수·타이머 미션을 해내야 알림이 꺼져요.' },
  { emoji: '📈', title: '자동 기록', desc: '완료하면 횟수와 시간이 저장되고 히트맵으로 쌓여요.' },
  { emoji: '🎯', title: '다음 운동 추천', desc: '체감 난이도 1탭으로 다음 주 분량을 추천받아요.' },
  { emoji: '⚡', title: '5~15분 목표', desc: '템플릿 10종으로 부담 없이 바로 시작할 수 있어요.' },
];

export default function LandingPage() {
  return (
    <main
      id="main"
      className="min-h-dvh bg-gradient-to-b from-indigo-50 via-white to-violet-50 text-slate-900"
    >
      <div className="mx-auto w-full max-w-md px-5 pb-12 pt-10">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 text-lg font-bold text-white"
          >
            M
          </span>
          <span className="text-lg font-bold">MOAYO</span>
        </div>

        <h1 className="mt-10 text-3xl font-extrabold leading-tight">
          5분 운동,
          <br />
          <span className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text text-transparent">MOAYO</span>와 함께
        </h1>
        <p className="mt-4 leading-relaxed text-slate-600">
          알림을 끄려면 운동 미션을 해내세요.
          <br />
          기록은 자동으로 쌓이고, 다음 운동은 추천해 드려요.
        </p>

        <div className="mt-7 flex gap-3">
          <Link
            href="/onboarding"
            className="flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 font-bold text-white shadow-lg shadow-indigo-200"
          >
            시작하기
          </Link>
          <a
            href="#features"
            className="flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 font-semibold text-slate-800"
          >
            기능 보기
          </a>
        </div>

        <section aria-label="미리보기" className="mt-10 rounded-3xl bg-white p-5 shadow-xl shadow-indigo-100">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500">이번 주 운동 시간</p>
              <p className="mt-1 text-2xl font-extrabold">42분</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              목표 80% 달성
            </span>
          </div>
          <ul aria-label="요일별 운동량 예시" className="mt-5 flex h-24 items-end gap-2">
            {WEEK.map((w) => (
              <li key={w.day} className="flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-lg bg-gradient-to-b from-violet-200 to-indigo-300"
                  style={{ height: `${w.value}%` }}
                />
                <span className="sr-only">{w.day}요일</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 grid grid-cols-4 gap-2">
            {EXERCISES.map((e) => (
              <li key={e.label} className={`${e.tone} flex flex-col items-center gap-1 rounded-2xl py-3`}>
                <span aria-hidden="true" className="text-xl">
                  {e.emoji}
                </span>
                <span className="text-xs font-semibold text-slate-700">{e.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section id="features" aria-labelledby="features-title" className="mt-12">
          <h2 id="features-title" className="border-l-4 border-indigo-400 pl-3 text-lg font-bold">
            주요 기능
          </h2>
          <ul className="mt-4 space-y-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4">
                <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl">
                  {f.emoji}
                </span>
                <div>
                  <h3 className="font-bold">{f.title}</h3>
                  <p className="mt-0.5 text-sm text-slate-600">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 px-6 py-8 text-center text-white">
          <p className="text-sm text-indigo-100">지금 바로 시작하세요</p>
          <p className="mt-1 text-xl font-extrabold">무료로 MOAYO 사용하기</p>
          <Link
            href="/onboarding"
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-8 font-bold text-indigo-700"
          >
            시작하기
          </Link>
        </section>

        <footer className="mt-10 space-y-1 text-center text-xs text-slate-500">
          <p>MOAYO는 의학적 조언이 아니에요. 통증이나 이상이 느껴지면 운동을 멈추세요.</p>
          <p>© 2026 MOAYO. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
