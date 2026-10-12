'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pencil } from 'lucide-react';
import { useDictionary } from '@/components/i18n-provider';
import { ManageBookingDialog, type BookingItem } from '@/components/manage-booking-dialog';
import { isPeriodKey } from '@/lib/booking-settings';

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  awaiting_payment_proof: 'outline',
  pending_review: 'secondary',
  confirmed: 'default',
  arrived: 'default',
  in_progress: 'default',
  completed: 'default',
  cancelled: 'destructive',
  rejected: 'destructive',
  no_show: 'destructive',
  expired: 'destructive',
};

export default function OverviewPage() {
  const dict = useDictionary();
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [today, setToday] = useState<{ booked: number; max_per_day: number | null; is_full: boolean } | null>(null);

  const supabase = useMemo(() => createClient(), []);

  async function loadData() {
    setLoading(true);
    const [{ count }, { data: bookingRows }] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
      supabase
        .from('bookings')
        .select(
          'id, pack_name_en, car_type, price, status, booking_date, booking_time, created_at, user_id, user_package_id, profiles(full_name, phone)'
        )
        .order('created_at', { ascending: false })
        .limit(200),
    ]);

    const d = new Date();
    const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const { data: load } = await supabase.rpc('booking_availability', { p_from: todayIso, p_to: todayIso });
    setToday(load?.[0] ?? null);

    setCustomerCount(count ?? 0);
    setBookings((bookingRows as unknown as BookingItem[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleBookingSaved(updated: BookingItem) {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
    loadData();
  }

  const pendingReview = bookings.filter((b) => b.status === 'pending_review').length;
  const activePipeline = bookings.filter((b) =>
    ['confirmed', 'arrived', 'in_progress'].includes(b.status)
  ).length;

  const now = new Date();
  const monthRevenue = bookings
    .filter((b) => {
      if (b.status !== 'completed') return false;
      const d = new Date(b.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + Number(b.price ?? 0), 0);

  const completedCount = bookings.filter((b) => b.status === 'completed').length;
  const recent = bookings.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={dict.overview.todayLoad}
          value={
            loading
              ? '…'
              : !today
                ? '—'
                : today.max_per_day === null
                ? today.booked
                : `${today.booked} / ${today.max_per_day}`
          }
          hint={
            today
              ? today.is_full
                ? dict.overview.full
                : today.max_per_day === null
                  ? dict.overview.todayLoadNoLimit.replace('{booked}', String(today.booked))
                  : dict.overview.todayLoadValue
                      .replace('{booked}', String(today.booked))
                      .replace('{max}', String(today.max_per_day))
              : undefined
          }
          alert={!!today?.is_full}
        />
        <StatCard label={dict.overview.customers} value={loading ? '…' : customerCount} />
        <StatCard
          label={dict.overview.pendingReview}
          value={loading ? '…' : pendingReview}
          hint={dict.overview.pendingReviewHint}
        />
        <StatCard
          label={dict.overview.activePipeline}
          value={loading ? '…' : activePipeline}
          hint={dict.overview.activePipelineHint}
        />
        <StatCard
          label={dict.overview.revenueThisMonth}
          value={loading ? '…' : `${monthRevenue.toLocaleString()} ${dict.common.egp}`}
          hint={dict.overview.completedAllTime.replace('{count}', String(completedCount))}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>{dict.overview.recentBookings}</CardTitle>
            <CardDescription>{dict.overview.recentBookingsDesc}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dict.overview.pack}</TableHead>
                <TableHead>{dict.overview.carType}</TableHead>
                <TableHead>{dict.overview.price}</TableHead>
                <TableHead>{dict.overview.date}</TableHead>
                <TableHead>{dict.overview.status}</TableHead>
                <TableHead className="text-end">{dict.overview.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {dict.overview.noBookings}
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                recent.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">
                      {b.pack_name_en ?? '—'}
                      {b.user_package_id && (
                        <Badge variant="outline" className="ms-2">
                          {dict.overview.packageBadge}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="capitalize">{b.car_type ?? '—'}</TableCell>
                    <TableCell>
                      {b.price ? `${Number(b.price).toLocaleString()} ${dict.common.egp}` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {b.booking_date ?? new Date(b.created_at).toLocaleDateString()}
                      {b.booking_time && (
                        <span className="block text-xs">
                          {isPeriodKey(b.booking_time)
                            ? dict.settings.periodNames[b.booking_time]
                            : b.booking_time}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[b.status] ?? 'outline'}>
                        {dict.overview.statuses?.[b.status as keyof typeof dict.overview.statuses] ?? b.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={dict.overview.manageBooking}
                        onClick={() => setSelectedBooking(b)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ManageBookingDialog
        booking={selectedBooking}
        supabase={supabase}
        open={!!selectedBooking}
        onOpenChange={(open) => !open && setSelectedBooking(null)}
        onSaved={handleBookingSaved}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string | number;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-destructive' : undefined}>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      {hint && (
        <CardContent className="pt-0">
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      )}
    </Card>
  );
}
