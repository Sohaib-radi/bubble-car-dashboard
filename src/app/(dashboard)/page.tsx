import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getDictionary } from '@/i18n';
import { getLocale } from '@/i18n/get-locale';

type Booking = {
  id: string;
  pack_name_en: string | null;
  car_type: string | null;
  price: number | null;
  status: string;
  booking_date: string | null;
  created_at: string;
};

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

export default async function OverviewPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const supabase = await createClient();

  const [{ count: customerCount }, { data: bookings }] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
    supabase
      .from('bookings')
      .select('id, pack_name_en, car_type, price, status, booking_date, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const all: Booking[] = bookings ?? [];
  const pendingReview = all.filter((b) => b.status === 'pending_review').length;
  const activePipeline = all.filter((b) =>
    ['confirmed', 'arrived', 'in_progress'].includes(b.status)
  ).length;

  const now = new Date();
  const monthRevenue = all
    .filter((b) => {
      if (b.status !== 'completed') return false;
      const d = new Date(b.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + Number(b.price ?? 0), 0);

  const completedCount = all.filter((b) => b.status === 'completed').length;
  const recent = all.slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={dict.overview.customers} value={customerCount ?? 0} />
        <StatCard
          label={dict.overview.pendingReview}
          value={pendingReview}
          hint={dict.overview.pendingReviewHint}
        />
        <StatCard
          label={dict.overview.activePipeline}
          value={activePipeline}
          hint={dict.overview.activePipelineHint}
        />
        <StatCard
          label={dict.overview.revenueThisMonth}
          value={`${monthRevenue.toLocaleString()} ${dict.common.egp}`}
          hint={dict.overview.completedAllTime.replace('{count}', String(completedCount))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{dict.overview.recentBookings}</CardTitle>
          <CardDescription>{dict.overview.recentBookingsDesc}</CardDescription>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {dict.overview.noBookings}
                  </TableCell>
                </TableRow>
              )}
              {recent.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.pack_name_en ?? '—'}</TableCell>
                  <TableCell className="capitalize">{b.car_type ?? '—'}</TableCell>
                  <TableCell>
                    {b.price ? `${Number(b.price).toLocaleString()} ${dict.common.egp}` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {b.booking_date ?? new Date(b.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[b.status] ?? 'outline'}>{b.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card>
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
