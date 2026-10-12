'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDictionary } from '@/components/i18n-provider';

const CAR_TYPES = ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'other'] as const;
type CarType = (typeof CAR_TYPES)[number];
type Prices = Partial<Record<CarType, number>>;

type PackOption = { id: string; name_en: string; prices: Prices };

type PackageItem = { pack_id: string; quantity: number };

type PackageRow = {
  id: string;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  active: boolean;
  items: PackageItem[];
  prices: Prices;
};

function pricesFor(
  rows: { car_type: string; price: number; [k: string]: unknown }[],
  key: 'pack_id' | 'package_id',
  id: string
): Prices {
  return Object.fromEntries(
    rows.filter((r) => r[key] === id).map((r) => [r.car_type, Number(r.price)])
  ) as Prices;
}

export default function PackagesPage() {
  const dict = useDictionary();
  const supabase = useMemo(() => createClient(), []);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [packs, setPacks] = useState<PackOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PackageRow | 'new' | null>(null);

  async function loadData() {
    setLoading(true);
    const [pkgRes, itemRes, priceRes, packRes, packPriceRes] = await Promise.all([
      supabase
        .from('packages')
        .select('id, name_en, name_ar, description_en, description_ar, active')
        .order('created_at'),
      supabase.from('package_items').select('package_id, pack_id, quantity'),
      supabase.from('package_prices').select('package_id, car_type, price'),
      supabase.from('packs').select('id, name_en').order('name_en'),
      supabase.from('pack_prices').select('pack_id, car_type, price'),
    ]);

    // Packs load independently so the editor's pack picker still works if the
    // packages tables have a problem.
    setPacks(
      (packRes.data ?? []).map((p) => ({
        ...p,
        prices: pricesFor(packPriceRes.data ?? [], 'pack_id', p.id),
      }))
    );

    const error = pkgRes.error ?? itemRes.error ?? priceRes.error ?? packRes.error ?? packPriceRes.error;
    if (error) {
      toast.error(dict.packages.loadFailed, { description: error.message });
      setLoading(false);
      return;
    }

    setPackages(
      (pkgRes.data ?? []).map((p) => ({
        ...p,
        items: (itemRes.data ?? [])
          .filter((i) => i.package_id === p.id)
          .map((i) => ({ pack_id: i.pack_id, quantity: i.quantity })),
        prices: pricesFor(priceRes.data ?? [], 'package_id', p.id),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleActive(pkg: PackageRow) {
    const { error } = await supabase
      .from('packages')
      .update({ active: !pkg.active })
      .eq('id', pkg.id);
    if (error) {
      toast.error(dict.packages.saveFailed, { description: error.message });
      return;
    }
    setPackages((ps) => ps.map((p) => (p.id === pkg.id ? { ...p, active: !p.active } : p)));
  }

  async function deletePackage(id: string) {
    if (!confirm(dict.packages.deleteConfirm)) return;
    const { error } = await supabase.from('packages').delete().eq('id', id);
    if (error) {
      toast.error(dict.packages.deleteFailed, { description: error.message });
      return;
    }
    setPackages((ps) => ps.filter((p) => p.id !== id));
    toast.success(dict.packages.deletedToast);
  }

  const packName = (id: string) => packs.find((p) => p.id === id)?.name_en ?? '—';

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setEditing('new')}>
          <Plus className="size-4" />
          {dict.packages.newPackage}
        </Button>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      )}

      {!loading && packages.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{dict.packages.empty}</p>
      )}

      {!loading && packages.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {packages.map((pkg) => {
            const total = pkg.items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <Card key={pkg.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle>{pkg.name_en}</CardTitle>
                      <CardDescription dir="rtl" className="text-start">
                        {pkg.name_ar}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={pkg.active} onCheckedChange={() => toggleActive(pkg)} />
                      <Button variant="ghost" size="icon" onClick={() => setEditing(pkg)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deletePackage(pkg.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {dict.packages.contents} ·{' '}
                      {dict.packages.washesTotal.replace('{count}', String(total))}
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {pkg.items.map((i) => (
                        <Badge key={i.pack_id} variant="secondary">
                          {i.quantity}× {packName(i.pack_id)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    {CAR_TYPES.filter((t) => pkg.prices[t] !== undefined).map((t) => (
                      <div key={t}>
                        <span className="block text-xs capitalize text-muted-foreground">
                          {dict.common.carTypes[t]}
                        </span>
                        <span className="font-medium">
                          {pkg.prices[t]!.toLocaleString()} {dict.common.egp}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{dict.packages.validity}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editing && (
        <PackageDialog
          key={editing === 'new' ? 'new' : editing.id}
          pkg={editing === 'new' ? null : editing}
          packs={packs}
          supabase={supabase}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function PackageDialog({
  pkg,
  packs,
  supabase,
  onClose,
  onSaved,
}: {
  pkg: PackageRow | null;
  packs: PackOption[];
  supabase: ReturnType<typeof createClient>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const dict = useDictionary();
  const [nameEn, setNameEn] = useState(pkg?.name_en ?? '');
  const [nameAr, setNameAr] = useState(pkg?.name_ar ?? '');
  const [descEn, setDescEn] = useState(pkg?.description_en ?? '');
  const [descAr, setDescAr] = useState(pkg?.description_ar ?? '');
  const [items, setItems] = useState<{ pack_id: string; quantity: string }[]>(
    pkg?.items.map((i) => ({ pack_id: i.pack_id, quantity: String(i.quantity) })) ?? [
      { pack_id: '', quantity: '1' },
    ]
  );
  const [prices, setPrices] = useState<Record<CarType, string>>(
    () =>
      Object.fromEntries(
        CAR_TYPES.map((t) => [t, pkg?.prices[t] !== undefined ? String(pkg.prices[t]) : ''])
      ) as Record<CarType, string>
  );
  const [saving, setSaving] = useState(false);

  const validItems = items
    .filter((i) => i.pack_id && Number(i.quantity) > 0)
    .map((i) => ({ pack_id: i.pack_id, quantity: Math.floor(Number(i.quantity)) }));

  // What the same washes would cost one by one — shown next to each price so
  // the manager can see the discount they are giving.
  function regularPrice(t: CarType): number | null {
    let sum = 0;
    for (const i of validItems) {
      const p = packs.find((pk) => pk.id === i.pack_id)?.prices[t];
      if (p === undefined) return null;
      sum += p * i.quantity;
    }
    return validItems.length ? sum : null;
  }

  async function handleSave() {
    if (!nameEn || !nameAr) {
      toast.error(dict.packages.nameRequired);
      return;
    }
    if (validItems.length === 0) {
      toast.error(dict.packages.itemsRequired);
      return;
    }
    const priceRows = CAR_TYPES.filter((t) => prices[t] !== '');
    if (priceRows.length === 0) {
      toast.error(dict.packages.priceRequired);
      return;
    }
    setSaving(true);

    const fields = {
      name_en: nameEn,
      name_ar: nameAr,
      description_en: descEn || null,
      description_ar: descAr || null,
    };
    const { data: saved, error } = pkg
      ? await supabase.from('packages').update(fields).eq('id', pkg.id).select('id').single()
      : await supabase.from('packages').insert(fields).select('id').single();

    if (error || !saved) {
      toast.error(dict.packages.saveFailed, { description: error?.message });
      setSaving(false);
      return;
    }

    // Replace contents and prices wholesale. Purchases keep their own snapshot
    // (user_package_items), so editing never changes what customers already bought.
    const steps = [
      () => supabase.from('package_items').delete().eq('package_id', saved.id),
      () =>
        supabase
          .from('package_items')
          .insert(validItems.map((i) => ({ ...i, package_id: saved.id }))),
      () => supabase.from('package_prices').delete().eq('package_id', saved.id),
      () =>
        supabase.from('package_prices').insert(
          priceRows.map((t) => ({ package_id: saved.id, car_type: t, price: Number(prices[t]) }))
        ),
    ];
    for (const step of steps) {
      const { error: stepError } = await step();
      if (stepError) {
        toast.error(dict.packages.saveFailed, { description: stepError.message });
        setSaving(false);
        return;
      }
    }

    toast.success(dict.packages.savedToast);
    setSaving(false);
    onSaved();
  }

  const usedPackIds = new Set(items.map((i) => i.pack_id));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{pkg ? dict.packages.editPackage : dict.packages.newPackage}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{dict.packages.nameEn}</Label>
              <Input
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                placeholder="e.g. Monthly 5 Washes"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{dict.packages.nameAr}</Label>
              <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{dict.packages.descriptionEn}</Label>
              <Textarea rows={2} value={descEn} onChange={(e) => setDescEn(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{dict.packages.descriptionAr}</Label>
              <Textarea
                rows={2}
                value={descAr}
                onChange={(e) => setDescAr(e.target.value)}
                dir="rtl"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs">{dict.packages.contents}</Label>
            {items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={item.pack_id}
                  onValueChange={(v) =>
                    setItems((its) => its.map((it, i) => (i === idx ? { ...it, pack_id: v } : it)))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={dict.packages.selectPack} />
                  </SelectTrigger>
                  <SelectContent>
                    {packs
                      .filter((p) => p.id === item.pack_id || !usedPackIds.has(p.id))
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name_en}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  aria-label={dict.packages.quantity}
                  value={item.quantity}
                  onChange={(e) =>
                    setItems((its) =>
                      its.map((it, i) => (i === idx ? { ...it, quantity: e.target.value } : it))
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={items.length === 1}
                  onClick={() => setItems((its) => its.filter((_, i) => i !== idx))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={items.length >= packs.length}
              onClick={() => setItems((its) => [...its, { pack_id: '', quantity: '1' }])}
            >
              <Plus className="size-3.5" />
              {dict.packages.addPack}
            </Button>
          </div>

          <Separator />

          <div>
            <Label className="mb-2 block text-xs">{dict.packages.priceByCarType}</Label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {CAR_TYPES.map((t) => {
                const regular = regularPrice(t);
                return (
                  <div key={t} className="space-y-1">
                    <Label className="text-xs capitalize text-muted-foreground">
                      {dict.common.carTypes[t]}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder={dict.packages.noPrice}
                      value={prices[t]}
                      onChange={(e) => setPrices((p) => ({ ...p, [t]: e.target.value }))}
                    />
                    {regular !== null && (
                      <span className="block text-[11px] text-muted-foreground">
                        {dict.packages.regularPrice.replace(
                          '{price}',
                          `${regular.toLocaleString()} ${dict.common.egp}`
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{dict.packages.validity}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {dict.common.cancel}
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? dict.common.saving : dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
