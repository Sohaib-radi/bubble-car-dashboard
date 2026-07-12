import { createClient } from '@/lib/supabase/server';
import { NavLink } from '@/components/nav-link';
import { DashboardHeader } from '@/components/dashboard-header';
import { BrandMark } from '@/components/brand-mark';
import { getDictionary } from '@/i18n';
import { getLocale } from '@/i18n/get-locale';
import { LayoutDashboard, Users, Package, Wallet, Car } from 'lucide-react';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName = '';
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    fullName = profile?.full_name ?? '';
  }

  const navItems = [
    { href: '/', label: dict.nav.overview, icon: <LayoutDashboard className="size-4" /> },
    { href: '/users', label: dict.nav.users, icon: <Users className="size-4" /> },
    { href: '/packs', label: dict.nav.packsPricing, icon: <Package className="size-4" /> },
    {
      href: '/payment-methods',
      label: dict.nav.paymentMethods,
      icon: <Wallet className="size-4" />,
    },
    { href: '/car-catalog', label: dict.nav.carCatalog, icon: <Car className="size-4" /> },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col bg-sidebar p-4 text-sidebar-foreground">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <BrandMark />
          <div>
            <h1 className="text-sm font-semibold tracking-wide">{dict.nav.brand}</h1>
            <p className="text-xs text-sidebar-foreground/60">{dict.nav.brandSubtitle}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <DashboardHeader dict={dict} fullName={fullName} />
        <main className="flex-1 overflow-y-auto bg-background p-8">{children}</main>
      </div>
    </div>
  );
}
