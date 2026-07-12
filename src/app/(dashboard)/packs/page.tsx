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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDictionary } from '@/components/i18n-provider';

const CAR_TYPES = ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'other'] as const;
type CarType = (typeof CAR_TYPES)[number];

type Pack = {
  id: string;
  key: string | null;
  name_en: string;
  name_ar: string;
  description_en: string | null;
  description_ar: string | null;
  active: boolean;
};

type PackWithPrices = Pack & { prices: Partial<Record<CarType, number>> };

const emptyPrices = () =>
  Object.fromEntries(CAR_TYPES.map((t) => [t, ''])) as Record<CarType, string>;

export default function PacksPage() {
  const dict = useDictionary();
  const [packs, setPacks] = useState<PackWithPrices[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  async function loadPacks() {
    setLoading(true);
    const { data: packRows, error } = await supabase
      .from('packs')
      .select('id, key, name_en, name_ar, description_en, description_ar, active')
      .order('name_en');

    if (error || !packRows) {
      toast.error(dict.packs.loadFailed, { description: error?.message });
      setLoading(false);
      return;
    }

    const { data: priceRows } = await supabase
      .from('pack_prices')
      .select('pack_id, car_type, price')
      .in('pack_id', packRows.map((p) => p.id));

    setPacks(
      packRows.map((p) => ({
        ...p,
        prices: Object.fromEntries(
          (priceRows ?? [])
            .filter((pr) => pr.pack_id === p.id)
            .map((pr) => [pr.car_type, Number(pr.price)])
        ) as Partial<Record<CarType, number>>,
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleActive(pack: PackWithPrices) {
    const { error } = await supabase
      .from('packs')
      .update({ active: !pack.active })
      .eq('id', pack.id);
    if (error) {
      toast.error(dict.packs.saveFailed, { description: error.message });
      return;
    }
    setPacks((ps) => ps.map((p) => (p.id === pack.id ? { ...p, active: !p.active } : p)));
  }

  async function deletePack(id: string) {
    if (!confirm(dict.packs.deleteConfirm)) return;
    const { error } = await supabase.from('packs').delete().eq('id', id);
    if (error) {
      toast.error(dict.packs.deleteFailed, { description: error.message });
      return;
    }
    setPacks((ps) => ps.filter((p) => p.id !== id));
    toast.success(dict.packs.deletedToast);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <NewPackDialog supabase={supabase} onCreated={loadPacks} />
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {packs.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              supabase={supabase}
              onDelete={() => deletePack(pack.id)}
              onToggleActive={() => toggleActive(pack)}
              onSaved={loadPacks}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PackCard({
  pack,
  supabase,
  onDelete,
  onToggleActive,
  onSaved,
}: {
  pack: PackWithPrices;
  supabase: ReturnType<typeof createClient>;
  onDelete: () => void;
  onToggleActive: () => void;
  onSaved: () => void;
}) {
  const dict = useDictionary();
  const [nameEn, setNameEn] = useState(pack.name_en);
  const [nameAr, setNameAr] = useState(pack.name_ar);
  const [descEn, setDescEn] = useState(pack.description_en ?? '');
  const [descAr, setDescAr] = useState(pack.description_ar ?? '');
  const [prices, setPrices] = useState<Record<CarType, string>>(() => {
    const base = emptyPrices();
    for (const t of CAR_TYPES) {
      if (pack.prices[t] !== undefined) base[t] = String(pack.prices[t]);
    }
    return base;
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { error: packError } = await supabase
      .from('packs')
      .update({
        name_en: nameEn,
        name_ar: nameAr,
        description_en: descEn || null,
        description_ar: descAr || null,
      })
      .eq('id', pack.id);

    if (packError) {
      toast.error(dict.packs.saveFailed, { description: packError.message });
      setSaving(false);
      return;
    }

    const upserts = CAR_TYPES.filter((t) => prices[t] !== '').map((t) => ({
      pack_id: pack.id,
      car_type: t,
      price: Number(prices[t]),
    }));

    if (upserts.length > 0) {
      const { error: priceError } = await supabase
        .from('pack_prices')
        .upsert(upserts, { onConflict: 'pack_id,car_type' });
      if (priceError) {
        toast.error(dict.packs.savePricesFailed, { description: priceError.message });
        setSaving(false);
        return;
      }
    }

    toast.success(dict.packs.savedToast);
    setSaving(false);
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{pack.name_en}</CardTitle>
            <CardDescription>{pack.key ?? dict.common.noKey}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={pack.active} onCheckedChange={onToggleActive} />
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{dict.packs.nameEn}</Label>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.packs.nameAr}</Label>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.packs.descriptionEn}</Label>
            <Textarea
              rows={2}
              value={descEn}
              onChange={(e) => setDescEn(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.packs.descriptionAr}</Label>
            <Textarea
              rows={2}
              value={descAr}
              onChange={(e) => setDescAr(e.target.value)}
              dir="rtl"
            />
          </div>
        </div>

        <Separator />

        <div>
          <Label className="mb-2 block text-xs">{dict.packs.priceByCarType}</Label>
          <div className="grid grid-cols-3 gap-2">
            {CAR_TYPES.map((t) => (
              <div key={t} className="space-y-1">
                <Label className="text-xs capitalize text-muted-foreground">
                  {dict.common.carTypes[t]}
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={prices[t]}
                  onChange={(e) => setPrices((p) => ({ ...p, [t]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? dict.packs.saving : dict.packs.saveChanges}
        </Button>
      </CardContent>
    </Card>
  );
}

function NewPackDialog({
  supabase,
  onCreated,
}: {
  supabase: ReturnType<typeof createClient>;
  onCreated: () => void;
}) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [prices, setPrices] = useState<Record<CarType, string>>(emptyPrices());
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!nameEn || !nameAr) {
      toast.error(dict.packs.nameRequired);
      return;
    }
    setSaving(true);
    const { data: created, error } = await supabase
      .from('packs')
      .insert({ key: key || null, name_en: nameEn, name_ar: nameAr })
      .select('id')
      .single();

    if (error || !created) {
      toast.error(dict.packs.createFailed, { description: error?.message });
      setSaving(false);
      return;
    }

    const upserts = CAR_TYPES.filter((t) => prices[t] !== '').map((t) => ({
      pack_id: created.id,
      car_type: t,
      price: Number(prices[t]),
    }));

    if (upserts.length > 0) {
      await supabase.from('pack_prices').insert(upserts);
    }

    toast.success(dict.packs.createdToast);
    setSaving(false);
    setOpen(false);
    setKey('');
    setNameEn('');
    setNameAr('');
    setPrices(emptyPrices());
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          {dict.packs.newPack}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.packs.newPackDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{dict.packs.key}</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={dict.packs.keyPlaceholder}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.packs.nameEn}</Label>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.packs.nameAr}</Label>
            <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} dir="rtl" />
          </div>
          <div>
            <Label className="mb-2 block text-xs">{dict.packs.priceByCarTypeOptional}</Label>
            <div className="grid grid-cols-3 gap-2">
              {CAR_TYPES.map((t) => (
                <div key={t} className="space-y-1">
                  <Label className="text-xs capitalize text-muted-foreground">
                    {dict.common.carTypes[t]}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={prices[t]}
                    onChange={(e) => setPrices((p) => ({ ...p, [t]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? dict.packs.creating : dict.packs.createPack}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
