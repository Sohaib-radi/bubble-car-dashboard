'use client';

import { useState, useEffect } from 'react';
import type { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CheckCircle2, Clock, Copy, ExternalLink, Play, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useDictionary, useLocale } from '@/components/i18n-provider';

// Private bucket written by the customer app (see 20261012_payment_proofs.sql).
const PAYMENT_PROOF_BUCKET = 'payment-proofs';

// Statuses that take a place in the day (see booking_status_takes_capacity in SQL).
const CAPACITY_STATUSES = ['confirmed', 'arrived', 'in_progress', 'completed'];

export type BookingItem = {
  id: string;
  pack_name_en: string | null;
  car_type: string | null;
  price: number | null;
  status: string;
  booking_date: string | null;
  booking_time?: string | null;
  created_at: string;
  user_id?: string | null;
  user_package_id?: string | null;
  payment_method_label_en?: string | null;
  payment_method_label_ar?: string | null;
  payment_reference?: string | null;
  payment_proof_path?: string | null;
  profiles?: { full_name: string; phone: string | null } | null;
};

const ALL_STATUSES = [
  'pending_review',
  'confirmed',
  'arrived',
  'in_progress',
  'completed',
  'cancelled',
  'rejected',
  'no_show',
  'draft',
  'awaiting_payment_proof',
  'expired',
] as const;

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

export function ManageBookingDialog({
  booking,
  supabase,
  open,
  onOpenChange,
  onSaved,
}: {
  booking: BookingItem | null;
  supabase: ReturnType<typeof createClient>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (updatedBooking: BookingItem) => void;
}) {
  const dict = useDictionary();
  const locale = useLocale();
  const [status, setStatus] = useState<string>(booking?.status ?? 'pending_review');
  const [price, setPrice] = useState<string>(
    booking?.price !== null && booking?.price !== undefined ? String(booking.price) : ''
  );
  const [bookingDate, setBookingDate] = useState<string>(booking?.booking_date ?? '');
  const [saving, setSaving] = useState(false);
  // Keyed by path so a result for a previous booking is never shown.
  const [receipt, setReceipt] = useState<{ path: string; url: string | null } | null>(null);

  useEffect(() => {
    if (booking) {
      setStatus(booking.status);
      setPrice(booking.price !== null && booking.price !== undefined ? String(booking.price) : '');
      setBookingDate(booking.booking_date ?? '');
    }
  }, [booking]);

  const proofPath = booking?.payment_proof_path ?? null;
  useEffect(() => {
    if (!proofPath) return;
    let cancelled = false;
    supabase.storage
      .from(PAYMENT_PROOF_BUCKET)
      .createSignedUrl(proofPath, 60 * 60)
      .then(({ data, error }) => {
        if (!cancelled) setReceipt({ path: proofPath, url: error || !data ? null : data.signedUrl });
      });
    return () => {
      cancelled = true;
    };
  }, [proofPath, supabase]);
  const receiptLoaded = !!proofPath && receipt?.path === proofPath;
  const receiptUrl = receiptLoaded ? receipt.url : null;
  const receiptError = receiptLoaded && !receipt.url;

  if (!booking) return null;

  async function handleSave(newStatus?: string) {
    if (!booking) return;
    const targetStatus = newStatus ?? status;
    const targetDate = bookingDate.trim() || null;

    // Warn before pushing a full day over its limit.
    if (
      targetDate &&
      CAPACITY_STATUSES.includes(targetStatus) &&
      (!CAPACITY_STATUSES.includes(booking.status) || targetDate !== booking.booking_date)
    ) {
      const { data: load } = await supabase.rpc('booking_availability', {
        p_from: targetDate,
        p_to: targetDate,
      });
      const day = load?.[0];
      if (
        day?.is_full &&
        !confirm(
          dict.overview.dayFullWarning
            .replace('{booked}', String(day.booked))
            .replace('{max}', String(day.max_per_day))
        )
      ) {
        setStatus(booking.status);
        return;
      }
    }

    setSaving(true);

    const patch = {
      status: targetStatus,
      price: price ? Number(price) : null,
      booking_date: bookingDate.trim() || null,
    };

    const res = await fetch(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });

    const resData = await res.json().catch(() => ({}));

    if (!res.ok) {
      toast.error(dict.overview.updateBookingFailed, {
        description: resData.error || 'Failed to update booking',
      });
      setSaving(false);
      return;
    }

    toast.success(dict.overview.bookingUpdated);
    setSaving(false);
    onSaved({
      ...booking,
      ...patch,
    });
    onOpenChange(false);
  }

  const customerName = booking.profiles?.full_name || booking.user_id || '—';
  const customerPhone = booking.profiles?.phone;
  const paymentLabel = locale === 'ar'
    ? booking.payment_method_label_ar || booking.payment_method_label_en
    : booking.payment_method_label_en || booking.payment_method_label_ar;
  const reference = booking.payment_reference?.trim();

  async function copyReference() {
    if (!reference) return;
    await navigator.clipboard.writeText(reference);
    toast.success(dict.overview.copied);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>{dict.overview.manageBookingTitle}</DialogTitle>
            <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
              {dict.overview.statuses?.[status as keyof typeof dict.overview.statuses] ?? status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Reservation Summary */}
          <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-muted-foreground block">{dict.overview.customer}</span>
                <span className="font-medium">{customerName}</span>
                {customerPhone && (
                  <span className="text-xs text-muted-foreground block">{customerPhone}</span>
                )}
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{dict.overview.pack}</span>
                <span className="font-medium">{booking.pack_name_en ?? '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{dict.overview.carType}</span>
                <span className="font-medium capitalize">{booking.car_type ?? '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block">{dict.overview.date}</span>
                <span className="font-medium">
                  {booking.booking_date ?? new Date(booking.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Payment proof */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{dict.overview.payment}</Label>
            {booking.user_package_id ? (
              <p className="text-sm text-muted-foreground">{dict.overview.paidByPackage}</p>
            ) : (
              <div className="rounded-xl border p-3.5 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground block">{dict.overview.paymentMethod}</span>
                    <span className="font-medium">{paymentLabel || '—'}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">{dict.overview.paymentReference}</span>
                    {reference ? (
                      <button
                        type="button"
                        onClick={copyReference}
                        className="inline-flex items-center gap-1.5 font-mono font-medium hover:underline"
                        dir="ltr"
                      >
                        {reference}
                        <Copy className="size-3.5 text-muted-foreground" />
                      </button>
                    ) : (
                      <span className="font-medium">—</span>
                    )}
                  </div>
                </div>

                {proofPath && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{dict.overview.paymentReceipt}</span>
                      {receiptUrl && (
                        <a
                          href={receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs hover:underline"
                        >
                          {dict.overview.openReceipt}
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    {receiptError ? (
                      <p className="text-xs text-destructive">{dict.overview.receiptLoadFailed}</p>
                    ) : receiptUrl ? (
                      <a href={receiptUrl} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
                        <img
                          src={receiptUrl}
                          alt={dict.overview.paymentReceipt}
                          className="max-h-72 w-full rounded-lg border bg-muted/30 object-contain"
                        />
                      </a>
                    ) : (
                      <div className="h-40 w-full animate-pulse rounded-lg bg-muted" />
                    )}
                  </div>
                )}

                {!reference && !proofPath && (
                  <p className="text-xs text-muted-foreground">{dict.overview.noPaymentProof}</p>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{dict.overview.quickActions}</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button
                type="button"
                variant={status === 'confirmed' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  setStatus('confirmed');
                  handleSave('confirmed');
                }}
                disabled={saving}
              >
                <CheckCircle2 className="size-3.5" />
                {dict.overview.confirmBooking}
              </Button>
              <Button
                type="button"
                variant={status === 'in_progress' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  setStatus('in_progress');
                  handleSave('in_progress');
                }}
                disabled={saving}
              >
                <Play className="size-3.5" />
                {dict.overview.startProgress}
              </Button>
              <Button
                type="button"
                variant={status === 'completed' ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  setStatus('completed');
                  handleSave('completed');
                }}
                disabled={saving}
              >
                <Clock className="size-3.5" />
                {dict.overview.completeBooking}
              </Button>
              <Button
                type="button"
                variant={status === 'cancelled' ? 'destructive' : 'outline'}
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => {
                  setStatus('cancelled');
                  handleSave('cancelled');
                }}
                disabled={saving}
              >
                <XCircle className="size-3.5" />
                {dict.overview.cancelBooking}
              </Button>
            </div>
          </div>

          {/* Manual Form Editing */}
          <div className="space-y-3 pt-1 border-t">
            <div className="space-y-1">
              <Label className="text-xs">{dict.overview.status}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {dict.overview.statuses?.[st as keyof typeof dict.overview.statuses] ?? st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">
                  {dict.overview.price} ({dict.common.egp})
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">{dict.overview.date}</Label>
                <Input
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  placeholder="YYYY-MM-DD"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {dict.common.cancel}
          </Button>
          <Button type="button" onClick={() => handleSave()} disabled={saving}>
            {saving ? dict.common.saving : dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
