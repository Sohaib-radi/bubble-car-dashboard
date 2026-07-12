'use client';

import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { SignOutButton } from '@/components/sign-out-button';
import type { Dictionary } from '@/i18n';

export function DashboardHeader({ dict, fullName }: { dict: Dictionary; fullName: string }) {
  const pathname = usePathname();

  const pages = [
    { href: '/', title: dict.overview.title, subtitle: dict.overview.subtitle },
    { href: '/users', title: dict.users.title, subtitle: dict.users.subtitle },
    { href: '/packs', title: dict.packs.title, subtitle: dict.packs.subtitle },
    {
      href: '/payment-methods',
      title: dict.paymentMethods.title,
      subtitle: dict.paymentMethods.subtitle,
    },
    { href: '/car-catalog', title: dict.carCatalog.title, subtitle: dict.carCatalog.subtitle },
  ];

  const page =
    pages.find((p) => (p.href === '/' ? pathname === '/' : pathname.startsWith(p.href))) ??
    pages[0];

  return (
    <header className="flex items-center justify-between border-b bg-card px-8 py-4 shadow-sm shadow-black/[0.03]">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{page.title}</h2>
        <p className="text-sm text-muted-foreground">{page.subtitle}</p>
      </div>
      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        {fullName && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <UserRound className="size-4" />
            <span className="max-w-40 truncate">{fullName}</span>
          </div>
        )}
        <SignOutButton label={dict.nav.signOut} />
      </div>
    </header>
  );
}
