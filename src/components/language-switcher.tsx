'use client';

import { useRouter } from 'next/navigation';
import { Languages } from 'lucide-react';
import { useLocale } from '@/components/i18n-provider';
import { locales, localeCookieName, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

const LABELS: Record<Locale, string> = { en: 'EN', ar: 'AR' };

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    // Imperative DOM/cookie writes in a click handler, not a render-phase
    // mutation — safe, but the compiler-readiness lint can't tell the two apart.
    /* eslint-disable react-hooks/immutability */
    document.cookie = `${localeCookieName}=${next}; path=/; max-age=31536000`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
    /* eslint-enable react-hooks/immutability */
    router.refresh();
  }

  return (
    <div className="inline-flex items-center gap-1.5 text-sm">
      <Languages className="size-3.5 text-muted-foreground" />
      {locales.map((l, i) => (
        <span key={l} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-muted-foreground/40">/</span>}
          <button
            type="button"
            onClick={() => switchTo(l)}
            aria-pressed={locale === l}
            className={cn(
              'text-xs font-medium transition-colors',
              locale === l ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {LABELS[l]}
          </button>
        </span>
      ))}
    </div>
  );
}
