'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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

type PaymentMethod = {
  id: string;
  key: string | null;
  label_en: string;
  label_ar: string;
  account_info: string | null;
  instructions_en: string | null;
  instructions_ar: string | null;
  active: boolean;
};

export default function PaymentMethodsPage() {
  const dict = useDictionary();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('payment_methods')
      .select('id, key, label_en, label_ar, account_info, instructions_en, instructions_ar, active')
      .order('label_en');
    if (error) toast.error(dict.paymentMethods.loadFailed, { description: error.message });
    setMethods(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleActive(m: PaymentMethod) {
    const { error } = await supabase
      .from('payment_methods')
      .update({ active: !m.active })
      .eq('id', m.id);
    if (error) {
      toast.error(dict.paymentMethods.updateFailed, { description: error.message });
      return;
    }
    setMethods((ms) => ms.map((x) => (x.id === m.id ? { ...x, active: !x.active } : x)));
  }

  async function remove(id: string) {
    if (!confirm(dict.paymentMethods.deleteConfirm)) return;
    const { error } = await supabase.from('payment_methods').delete().eq('id', id);
    if (error) {
      toast.error(dict.paymentMethods.deleteFailed, { description: error.message });
      return;
    }
    setMethods((ms) => ms.filter((m) => m.id !== id));
    toast.success(dict.paymentMethods.deletedToast);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <NewMethodDialog supabase={supabase} onCreated={load} />
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      )}

      {!loading && (
        <div className="grid gap-4 md:grid-cols-2">
          {methods.map((m) => (
            <MethodCard
              key={m.id}
              method={m}
              supabase={supabase}
              onToggleActive={() => toggleActive(m)}
              onDelete={() => remove(m.id)}
              onSaved={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MethodCard({
  method,
  supabase,
  onToggleActive,
  onDelete,
  onSaved,
}: {
  method: PaymentMethod;
  supabase: ReturnType<typeof createClient>;
  onToggleActive: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const dict = useDictionary();
  const [labelEn, setLabelEn] = useState(method.label_en);
  const [labelAr, setLabelAr] = useState(method.label_ar);
  const [accountInfo, setAccountInfo] = useState(method.account_info ?? '');
  const [instructionsEn, setInstructionsEn] = useState(method.instructions_en ?? '');
  const [instructionsAr, setInstructionsAr] = useState(method.instructions_ar ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('payment_methods')
      .update({
        label_en: labelEn,
        label_ar: labelAr,
        account_info: accountInfo || null,
        instructions_en: instructionsEn || null,
        instructions_ar: instructionsAr || null,
      })
      .eq('id', method.id);

    if (error) {
      toast.error(dict.paymentMethods.saveFailed, { description: error.message });
    } else {
      toast.success(dict.paymentMethods.savedToast);
      onSaved();
    }
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>{method.label_en}</CardTitle>
            <CardDescription>{method.key ?? dict.common.noKey}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={method.active} onCheckedChange={onToggleActive} />
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{dict.paymentMethods.labelEn}</Label>
            <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.paymentMethods.labelAr}</Label>
            <Input value={labelAr} onChange={(e) => setLabelAr(e.target.value)} dir="rtl" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{dict.paymentMethods.accountInfo}</Label>
          <Input value={accountInfo} onChange={(e) => setAccountInfo(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{dict.paymentMethods.instructionsEn}</Label>
          <Textarea rows={2} value={instructionsEn} onChange={(e) => setInstructionsEn(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{dict.paymentMethods.instructionsAr}</Label>
          <Textarea
            rows={2}
            value={instructionsAr}
            onChange={(e) => setInstructionsAr(e.target.value)}
            dir="rtl"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? dict.paymentMethods.saving : dict.paymentMethods.saveChanges}
        </Button>
      </CardContent>
    </Card>
  );
}

function NewMethodDialog({
  supabase,
  onCreated,
}: {
  supabase: ReturnType<typeof createClient>;
  onCreated: () => void;
}) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [labelAr, setLabelAr] = useState('');
  const [accountInfo, setAccountInfo] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!labelEn || !labelAr) {
      toast.error(dict.paymentMethods.labelRequired);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('payment_methods').insert({
      key: key || null,
      label_en: labelEn,
      label_ar: labelAr,
      account_info: accountInfo || null,
    });
    if (error) {
      toast.error(dict.paymentMethods.createFailed, { description: error.message });
      setSaving(false);
      return;
    }
    toast.success(dict.paymentMethods.createdToast);
    setSaving(false);
    setOpen(false);
    setKey('');
    setLabelEn('');
    setLabelAr('');
    setAccountInfo('');
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" />
          {dict.paymentMethods.newMethod}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.paymentMethods.newMethodDialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{dict.paymentMethods.key}</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={dict.paymentMethods.keyPlaceholder}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.paymentMethods.labelEn}</Label>
            <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.paymentMethods.labelAr}</Label>
            <Input value={labelAr} onChange={(e) => setLabelAr(e.target.value)} dir="rtl" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.paymentMethods.accountInfoShort}</Label>
            <Input value={accountInfo} onChange={(e) => setAccountInfo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? dict.paymentMethods.creating : dict.paymentMethods.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
