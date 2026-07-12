'use client';

import { useEffect, useState } from 'react';
import type { createClient } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { useDictionary } from '@/components/i18n-provider';
import type { Profile } from './types';

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

export function UserDetailsDialog({
  profile,
  supabase,
  open,
  onOpenChange,
}: {
  profile: Profile;
  supabase: ReturnType<typeof createClient>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const dict = useDictionary();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, pack_name_en, car_type, price, status, booking_date, created_at')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        toast.error(dict.users.bookingsLoadFailed, { description: error.message });
      } else {
        setBookings(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, profile.id, supabase, dict.users.bookingsLoadFailed]);

  const totalEarned = bookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + Number(b.price ?? 0), 0);
  const completedCount = bookings.filter((b) => b.status === 'completed').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{profile.full_name || dict.users.detailsTitle}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{dict.users.totalEarned}</p>
            <p className="text-xl font-semibold">
              {totalEarned.toLocaleString()} {dict.common.egp}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{dict.users.totalBookings}</p>
            <p className="text-xl font-semibold">{bookings.length}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{dict.users.completedBookings}</p>
            <p className="text-xl font-semibold">{completedCount}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{dict.users.bookingHistory}</p>
          <div className="max-h-80 overflow-y-auto rounded-lg border">
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
                {loading &&
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))}
                {!loading && bookings.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {dict.users.noBookingsForUser}
                    </TableCell>
                  </TableRow>
                )}
                {!loading &&
                  bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.pack_name_en ?? '—'}</TableCell>
                      <TableCell className="capitalize">{b.car_type ?? '—'}</TableCell>
                      <TableCell>
                        {b.price
                          ? `${Number(b.price).toLocaleString()} ${dict.common.egp}`
                          : '—'}
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
