'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useDictionary } from '@/components/i18n-provider';

const CAR_TYPES = ['sedan', 'hatchback', 'suv', 'pickup', 'van', 'other'] as const;
type CarType = (typeof CAR_TYPES)[number];

type Make = { id: string; name: string };
type Model = { id: string; make_id: string; name: string; car_type: CarType };

export default function CarCatalogPage() {
  const dict = useDictionary();
  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedMakeId, setSelectedMakeId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMakeName, setNewMakeName] = useState('');
  const [newModelName, setNewModelName] = useState('');
  const [newModelType, setNewModelType] = useState<CarType>('sedan');
  const supabase = useMemo(() => createClient(), []);

  async function load() {
    setLoading(true);
    const [{ data: makeRows, error: makeErr }, { data: modelRows, error: modelErr }] =
      await Promise.all([
        supabase.from('car_makes').select('id, name').order('name'),
        supabase.from('car_models').select('id, make_id, name, car_type').order('name'),
      ]);
    if (makeErr) toast.error(dict.carCatalog.loadMakesFailed, { description: makeErr.message });
    if (modelErr) toast.error(dict.carCatalog.loadModelsFailed, { description: modelErr.message });
    setMakes(makeRows ?? []);
    setModels(modelRows ?? []);
    setSelectedMakeId((prev) => prev ?? makeRows?.[0]?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addMake() {
    if (!newMakeName.trim()) return;
    const { data, error } = await supabase
      .from('car_makes')
      .insert({ name: newMakeName.trim() })
      .select('id, name')
      .single();
    if (error || !data) {
      toast.error(dict.carCatalog.addMakeFailed, { description: error?.message });
      return;
    }
    setMakes((m) => [...m, data].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedMakeId(data.id);
    setNewMakeName('');
  }

  async function deleteMake(id: string) {
    if (!confirm(dict.carCatalog.deleteMakeConfirm)) return;
    const { error } = await supabase.from('car_makes').delete().eq('id', id);
    if (error) {
      toast.error(dict.carCatalog.deleteMakeFailed, { description: error.message });
      return;
    }
    setMakes((m) => m.filter((x) => x.id !== id));
    setModels((m) => m.filter((x) => x.make_id !== id));
    if (selectedMakeId === id) setSelectedMakeId(null);
  }

  async function addModel() {
    if (!selectedMakeId || !newModelName.trim()) return;
    const { data, error } = await supabase
      .from('car_models')
      .insert({ make_id: selectedMakeId, name: newModelName.trim(), car_type: newModelType })
      .select('id, make_id, name, car_type')
      .single();
    if (error || !data) {
      toast.error(dict.carCatalog.addModelFailed, { description: error?.message });
      return;
    }
    setModels((m) => [...m, data]);
    setNewModelName('');
  }

  async function deleteModel(id: string) {
    const { error } = await supabase.from('car_models').delete().eq('id', id);
    if (error) {
      toast.error(dict.carCatalog.deleteModelFailed, { description: error.message });
      return;
    }
    setModels((m) => m.filter((x) => x.id !== id));
  }

  const modelsForSelectedMake = models.filter((m) => m.make_id === selectedMakeId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[240px_1fr] gap-6">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={dict.carCatalog.newMakePlaceholder}
              value={newMakeName}
              onChange={(e) => setNewMakeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addMake()}
            />
            <Button size="icon" onClick={addMake}>
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto rounded-xl border bg-card p-2 shadow-md shadow-black/[0.04]">
            {makes.map((make) => (
              <button
                key={make.id}
                onClick={() => setSelectedMakeId(make.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-3 py-2 text-start text-sm',
                  selectedMakeId === make.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
              >
                <span>{make.name}</span>
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMake(make.id);
                  }}
                  className="opacity-60 hover:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {!selectedMakeId && (
            <p className="text-sm text-muted-foreground">{dict.carCatalog.selectOrAddMake}</p>
          )}
          {selectedMakeId && (
            <>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">{dict.carCatalog.newModelName}</Label>
                  <Input
                    value={newModelName}
                    onChange={(e) => setNewModelName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addModel()}
                    placeholder={dict.carCatalog.newModelPlaceholder}
                  />
                </div>
                <div className="w-40 space-y-1">
                  <Label className="text-xs">{dict.carCatalog.carType}</Label>
                  <Select value={newModelType} onValueChange={(v) => setNewModelType(v as CarType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CAR_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {dict.common.carTypes[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={addModel} className="gap-2">
                  <Plus className="size-4" />
                  {dict.carCatalog.add}
                </Button>
              </div>

              <div className="rounded-xl border bg-card shadow-md shadow-black/[0.04]">
                {modelsForSelectedMake.length === 0 && (
                  <p className="p-4 text-sm text-muted-foreground">{dict.carCatalog.noModels}</p>
                )}
                {modelsForSelectedMake.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center justify-between border-b px-4 py-2 last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{model.name}</span>
                      <Badge variant="secondary" className="capitalize">
                        {dict.common.carTypes[model.car_type]}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteModel(model.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
