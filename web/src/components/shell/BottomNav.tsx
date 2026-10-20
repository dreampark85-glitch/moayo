'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: '홈' },
  { href: '/records', label: '기록' },
  { href: '/plan', label: '계획' },
  { href: '/my', label: '마이' },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith('/mission')) return null;
  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto grid w-full max-w-md grid-cols-4 border-t border-slate-200 bg-white"
    >
      {ITEMS.map((item) => {
        const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex min-h-14 items-center justify-center text-sm font-semibold ${
              active ? 'text-emerald-700 underline decoration-2 underline-offset-8' : 'text-slate-600'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
