'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const STATUSES = ['pending_review', 'active', 'expired', 'cancelled', 'rejected'] as const;
type Status = (typeof STATUSES)[number];

const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending_review: 'secondary',
  active: 'default',
  expired: 'outline',
  cancelled: 'destructive',
  rejected: 'destructive',
};

type Balance = { pack_id: string; pack_name_en: string; quantity: number; used: number };

type UserPackage = {
  id: string;
  package_name_en: string;
  car_type: string;
  price: number;
  payment_method_label_en: string | null;
  payment_reference: string | null;
  status: Status;
  expires_at: string | null;
  created_at: string;
  profiles: { full_name: string; phone: string | null } | null;
  cars: {
    plate: string;
    custom_label: string | null;
    car_makes: { name: string } | null;
    car_models: { name: string } | null;
  } | null;
  balances: Balance[];
};

function carLabel(car: UserPackage['cars']) {
  if (!car) return '—';
  const name =
    car.custom_label ||
    [car.car_makes?.name, car.car_models?.name].filter(Boolean).join(' ') ||
    '—';
  return `${name} · ${car.plate}`;
}

export default function CustomerPackagesPage() {
  const dict = useDictionary();
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<UserPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    await supabase.rpc('expire_stale_user_packages');

    const { data, error } = await supabase
      .from('user_packages')
      .select(
        'id, package_name_en, car_type, price, payment_method_label_en, payment_reference, status, expires_at, created_at, profiles(full_name, phone), cars(plate, custom_label, car_makes(name), car_models(name))'
      )
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      toast.error(dict.customerPackages.loadFailed, { description: error.message });
      setLoading(false);
      return;
    }

    const ids = (data ?? []).map((r) => r.id);
    const { data: balances } = ids.length
      ? await supabase
          .from('user_package_balances')
          .select('user_package_id, pack_id, pack_name_en, quantity, used')
          .in('user_package_id', ids)
      : { data: [] };

    setRows(
      ((data ?? []) as unknown as Omit<UserPackage, 'balances'>[]).map((r) => ({
        ...r,
        balances: (balances ?? []).filter((b) => b.user_package_id === r.id),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setStatus(row: UserPackage, status: Status, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return;
    setBusyId(row.id);
    const { data, error } = await supabase
      .from('user_packages')
      .update({ status })
      .eq('id', row.id)
      .select('status, expires_at')
      .single();
    setBusyId(null);
    if (error || !data) {
      toast.error(dict.customerPackages.updateFailed, { description: error?.message });
      return;
    }
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, ...data } : r)));
    toast.success(dict.customerPackages.updated);
  }

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const cp = dict.customerPackages;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={filter} onValueChange={(v) => setFilter(v as Status | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{cp.allStatuses}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {cp.statuses[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{cp.customer}</TableHead>
                <TableHead>{cp.car}</TableHead>
                <TableHead>{cp.package}</TableHead>
                <TableHead>{cp.price}</TableHead>
                <TableHead>{cp.payment}</TableHead>
                <TableHead>{cp.usage}</TableHead>
                <TableHead>{cp.validUntil}</TableHead>
                <TableHead>{cp.status}</TableHead>
                <TableHead className="text-end">{cp.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {!loading && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    {cp.empty}
                  </TableCell>
                </TableRow>
              )}

              {!loading &&
                visible.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <span className="block font-medium">{r.profiles?.full_name ?? '—'}</span>
                      {r.profiles?.phone && (
                        <span className="text-xs text-muted-foreground">{r.profiles.phone}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="block">{carLabel(r.cars)}</span>
                      <span className="text-xs capitalize text-muted-foreground">{r.car_type}</span>
                    </TableCell>
                    <TableCell className="font-medium">{r.package_name_en}</TableCell>
                    <TableCell>
                      {Number(r.price).toLocaleString()} {dict.common.egp}
                    </TableCell>
                    <TableCell>
                      <span className="block">{r.payment_method_label_en ?? '—'}</span>
                      {r.payment_reference && (
                        <span className="font-mono text-xs text-muted-foreground">
                          {r.payment_reference}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        {r.balances.map((b) => (
                          <div key={b.pack_id}>
                            <span className="font-medium">
                              {b.used}/{b.quantity}
                            </span>{' '}
                            <span className="text-muted-foreground">{b.pack_name_en}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.expires_at ? new Date(r.expires_at).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status]}>{cp.statuses[r.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1.5">
                        {r.status === 'pending_review' && (
                          <>
                            <Button
                              size="sm"
                              disabled={busyId === r.id}
                              onClick={() => setStatus(r, 'active')}
                            >
                              {cp.activate}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === r.id}
                              onClick={() => setStatus(r, 'rejected', cp.rejectConfirm)}
                            >
                              {cp.reject}
                            </Button>
                          </>
                        )}
                        {r.status === 'active' && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === r.id}
                            onClick={() => setStatus(r, 'cancelled', cp.cancelConfirm)}
                          >
                            {cp.cancel}
                          </Button>
                        )}
                      </div>
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
