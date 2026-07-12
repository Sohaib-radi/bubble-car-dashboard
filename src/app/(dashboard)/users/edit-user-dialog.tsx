'use client';

import { useState } from 'react';
import type { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useDictionary } from '@/components/i18n-provider';
import type { Profile } from './types';

export function EditUserDialog({
  profile,
  supabase,
  open,
  onOpenChange,
  onSaved,
}: {
  profile: Profile;
  supabase: ReturnType<typeof createClient>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (id: string, patch: Partial<Profile>) => void;
}) {
  const dict = useDictionary();
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [address, setAddress] = useState(profile.address ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const patch = {
      full_name: fullName,
      phone: phone || null,
      address: address || null,
    };
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);

    if (error) {
      toast.error(dict.users.updateFailed, { description: error.message });
      setSaving(false);
      return;
    }

    toast.success(dict.users.updatedToast);
    setSaving(false);
    onSaved(profile.id, patch);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dict.users.editUserTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{dict.users.fullNameLabel}</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.users.phoneLabel}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.users.addressLabel}</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? dict.common.saving : dict.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
