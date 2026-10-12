'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Award,
  Droplet,
  Feather,
  Heart,
  Layers,
  type LucideIcon,
  Shield,
  Star,
  Sun,
  Thermometer,
  Trash2,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useDictionary } from '@/components/i18n-provider';
import { cn } from '@/lib/utils';
import {
  type BookingSettings,
  DEFAULT_BOOKING_SETTINGS,
  defaultServiceIcon,
  fetchBookingSettings,
  PERIOD_KEYS,
  type PeriodKey,
  SERVICE_ICONS,
  type ServiceIcon,
} from '@/lib/booking-settings';

const ICON_COMPONENTS: Record<ServiceIcon, LucideIcon> = {
  droplet: Droplet,
  wind: Wind,
  sun: Sun,
  star: Star,
  shield: Shield,
  zap: Zap,
  feather: Feather,
  award: Award,
  thermometer: Thermometer,
  tool: Wrench,
  layers: Layers,
  heart: Heart,
};

export default function SettingsPage() {
  const dict = useDictionary();
  return (
    <Tabs defaultValue="booking" className="space-y-4">
      <TabsList>
        <TabsTrigger value="booking">{dict.settings.tabs.booking}</TabsTrigger>
        <TabsTrigger value="blocks">{dict.settings.tabs.blocks}</TabsTrigger>
        <TabsTrigger value="services">{dict.settings.tabs.services}</TabsTrigger>
      </TabsList>
      <TabsContent value="booking">
        <BookingTab />
      </TabsContent>
      <TabsContent value="blocks">
        <BlocksTab />
      </TabsContent>
      <TabsContent value="services">
        <ServicesTab />
      </TabsContent>
    </Tabs>
  );
}

function BookingTab() {
  const dict = useDictionary();
  const supabase = useMemo(() => createClient(), []);
  const [settings, setSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [maxInput, setMaxInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchBookingSettings(supabase).then((s) => {
      setSettings(s);
      setMaxInput(s.max_per_day === null ? '' : String(s.max_per_day));
      setLoading(false);
    });
  }, [supabase]);

  function setPeriod(key: PeriodKey, patch: Partial<BookingSettings['periods'][number]>) {
    setSettings((s) => ({
      ...s,
      periods: s.periods.map((p) => (p.key === key ? { ...p, ...patch } : p)),
    }));
  }

  async function handleSave() {
    setSaving(true);
    const value: BookingSettings = {
      ...settings,
      max_per_day: maxInput.trim() === '' ? null : Math.max(0, Math.floor(Number(maxInput))),
    };
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'booking', value, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast.error(dict.settings.saveFailed, { description: error.message });
      return;
    }
    toast.success(dict.settings.saved);
  }

  if (loading) return <Skeleton className="h-96 w-full max-w-2xl" />;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{dict.settings.tabs.booking}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-1.5">
          <Label>{dict.settings.maxPerDay}</Label>
          <Input
            type="number"
            min={0}
            className="w-40"
            value={maxInput}
            onChange={(e) => setMaxInput(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{dict.settings.maxPerDayHint}</p>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label>{dict.settings.showToCustomers}</Label>
            <p className="text-xs text-muted-foreground">{dict.settings.showToCustomersHint}</p>
          </div>
          <Switch
            checked={settings.show_capacity_to_customers}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, show_capacity_to_customers: v }))}
          />
        </div>

        <Separator />

        <div className="space-y-3">
          <div>
            <Label>{dict.settings.periods}</Label>
            <p className="text-xs text-muted-foreground">{dict.settings.periodsHint}</p>
          </div>
          {settings.periods.map((p) => (
            <div key={p.key} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <Switch checked={p.enabled} onCheckedChange={(v) => setPeriod(p.key, { enabled: v })} />
              <span className="w-28 font-medium">{dict.settings.periodNames[p.key]}</span>
              <Label className="text-xs text-muted-foreground">{dict.settings.from}</Label>
              <Input
                type="time"
                className="w-32"
                value={p.start}
                onChange={(e) => setPeriod(p.key, { start: e.target.value })}
              />
              <Label className="text-xs text-muted-foreground">{dict.settings.to}</Label>
              <Input
                type="time"
                className="w-32"
                value={p.end}
                onChange={(e) => setPeriod(p.key, { end: e.target.value })}
              />
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? dict.common.saving : dict.common.save}
        </Button>
      </CardContent>
    </Card>
  );
}

type Block = {
  id: string;
  start_date: string;
  end_date: string;
  period: PeriodKey | null;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type BlockKind = 'day' | 'period' | 'time';

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "14:00:00" → "14:00"; "24:00:00" → "00:00" (midnight)
function hhmm(t: string | null) {
  if (!t) return '';
  const v = t.slice(0, 5);
  return v === '24:00' ? '00:00' : v;
}

function BlocksTab() {
  const dict = useDictionary();
  const supabase = useMemo(() => createClient(), []);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [kind, setKind] = useState<BlockKind>('day');
  const [period, setPeriodValue] = useState<PeriodKey>('evening');
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('16:00');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadBlocks() {
    const { data, error } = await supabase
      .from('booking_blocks')
      .select('id, start_date, end_date, period, start_time, end_time, reason')
      .gte('end_date', todayIso())
      .order('start_date');
    if (error) toast.error(dict.settings.loadFailed, { description: error.message });
    setBlocks((data as Block[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addBlock() {
    if (endDate < startDate) {
      toast.error(dict.settings.invalidDateRange);
      return;
    }
    // A time range ending at 00:00 means "until midnight".
    const end = endTime === '00:00' ? '24:00' : endTime;
    if (kind === 'time' && end <= startTime) {
      toast.error(dict.settings.invalidTimeRange);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('booking_blocks').insert({
      start_date: startDate,
      end_date: endDate,
      period: kind === 'period' ? period : null,
      start_time: kind === 'time' ? startTime : null,
      end_time: kind === 'time' ? end : null,
      reason: reason.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(dict.settings.blockFailed, { description: error.message });
      return;
    }
    setReason('');
    toast.success(dict.settings.blockAdded);
    loadBlocks();
  }

  async function removeBlock(id: string) {
    const { error } = await supabase.from('booking_blocks').delete().eq('id', id);
    if (error) {
      toast.error(dict.settings.blockFailed, { description: error.message });
      return;
    }
    setBlocks((bs) => bs.filter((b) => b.id !== id));
    toast.success(dict.settings.blockRemoved);
  }

  const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  const whatLabel = (b: Block) =>
    b.start_time
      ? `${hhmm(b.start_time)} → ${hhmm(b.end_time)}`
      : b.period
        ? dict.settings.periodNames[b.period]
        : dict.settings.wholeDay;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{dict.settings.tabs.blocks}</CardTitle>
        <CardDescription>{dict.settings.blocksHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{dict.settings.fromDate}</Label>
              <Input
                type="date"
                min={todayIso()}
                className="w-40"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{dict.settings.toDate}</Label>
              <Input
                type="date"
                min={startDate}
                className="w-40"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{dict.settings.closeWhat}</Label>
            <div className="flex flex-wrap gap-1.5">
              {(['day', 'period', 'time'] as const).map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={kind === k ? 'default' : 'outline'}
                  onClick={() => setKind(k)}
                >
                  {dict.settings.blockKinds[k]}
                </Button>
              ))}
            </div>
          </div>

          {kind === 'period' && (
            <Select value={period} onValueChange={(v) => setPeriodValue(v as PeriodKey)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {dict.settings.periodNames[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {kind === 'time' && (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs text-muted-foreground">{dict.settings.from}</Label>
                <Input
                  type="time"
                  className="w-32"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <Label className="text-xs text-muted-foreground">{dict.settings.to}</Label>
                <Input
                  type="time"
                  className="w-32"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">{dict.settings.timeRangeHint}</p>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-48 flex-1 space-y-1">
              <Label className="text-xs">{dict.settings.reason}</Label>
              <Input
                value={reason}
                placeholder={dict.settings.reasonPlaceholder}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button onClick={addBlock} disabled={saving || !startDate || !endDate}>
              {dict.settings.addBlock}
            </Button>
          </div>
        </div>

        {loading && <Skeleton className="h-20 w-full" />}
        {!loading && blocks.length === 0 && (
          <p className="text-sm text-muted-foreground">{dict.settings.noBlocks}</p>
        )}
        <div className="space-y-2">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <div className="text-sm">
                <span className="font-medium">
                  {formatDate(b.start_date)}
                  {b.end_date !== b.start_date && ` → ${formatDate(b.end_date)}`}
                </span>
                <span className="ms-2 text-muted-foreground">{whatLabel(b)}</span>
                {b.reason && <span className="ms-2 text-muted-foreground">· {b.reason}</span>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeBlock(b.id)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type PackIconRow = { id: string; key: string | null; name_en: string; icon: string | null };

function ServicesTab() {
  const dict = useDictionary();
  const supabase = useMemo(() => createClient(), []);
  const [packs, setPacks] = useState<PackIconRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('packs')
      .select('id, key, name_en, icon')
      .order('name_en')
      .then(({ data, error }) => {
        if (error) toast.error(dict.settings.loadFailed, { description: error.message });
        setPacks(data ?? []);
        setLoading(false);
      });
  }, [supabase, dict]);

  async function setIcon(pack: PackIconRow, icon: string | null) {
    const { error } = await supabase.from('packs').update({ icon }).eq('id', pack.id);
    if (error) {
      toast.error(dict.settings.saveFailed, { description: error.message });
      return;
    }
    setPacks((ps) => ps.map((p) => (p.id === pack.id ? { ...p, icon } : p)));
    toast.success(dict.settings.iconSaved);
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>{dict.settings.tabs.services}</CardTitle>
        <CardDescription>{dict.settings.servicesHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <Skeleton className="h-40 w-full" />}
        {packs.map((pack) => {
          const effective = (pack.icon as ServiceIcon | null) ?? defaultServiceIcon(pack.key);
          return (
            <div key={pack.id} className="space-y-2 rounded-lg border p-3">
              <span className="font-medium">{pack.name_en}</span>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant={pack.icon === null ? 'default' : 'outline'}
                  onClick={() => setIcon(pack, null)}
                >
                  {dict.settings.defaultIcon}
                </Button>
                {SERVICE_ICONS.map((name) => {
                  const Icon = ICON_COMPONENTS[name];
                  return (
                    <Button
                      key={name}
                      size="icon"
                      variant="outline"
                      aria-label={name}
                      className={cn(
                        effective === name && 'border-primary bg-primary/10 text-primary',
                        pack.icon === null && effective === name && 'border-dashed'
                      )}
                      onClick={() => setIcon(pack, name)}
                    >
                      <Icon className="size-4" />
                    </Button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
