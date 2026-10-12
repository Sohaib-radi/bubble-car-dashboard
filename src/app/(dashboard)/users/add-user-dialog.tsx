'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useDictionary } from '@/components/i18n-provider';
import type { Profile, Role } from './types';

export function AddUserDialog({
  onCreated,
}: {
  onCreated: (newProfile: Profile) => void;
}) {
  const dict = useDictionary();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('customer');
  const [address, setAddress] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(true);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setFullName('');
    setPhone('');
    setPassword('');
    setRole('customer');
    setAddress('');
    setPhoneVerified(true);
  }

  async function handleCreate() {
    if (!phone.trim()) {
      toast.error(dict.users.phoneRequired);
      return;
    }
    if (!password || password.length < 6) {
      toast.error(dict.users.passwordRequired);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          phone: phone.trim(),
          password,
          role,
          address: address.trim() || null,
          phone_verified: phoneVerified,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(dict.users.createUserFailed, {
          description: data.error || 'Failed to create user',
        });
        setSaving(false);
        return;
      }

      toast.success(dict.users.createdToast);
      setSaving(false);
      resetForm();
      setOpen(false);
      if (data.profile) {
        onCreated(data.profile);
      }
    } catch (err) {
      toast.error(dict.users.createUserFailed, {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="size-4" />
          {dict.users.addUser}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{dict.users.newUserTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs">{dict.users.fullNameLabel}</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Ahmed Ali"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.users.phoneLabel} *</Label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01000000000"
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.users.passwordLabel} *</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <p className="text-[11px] text-muted-foreground">{dict.users.passwordHint}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.users.role}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">{dict.common.roles.customer}</SelectItem>
                <SelectItem value="staff">{dict.common.roles.staff}</SelectItem>
                <SelectItem value="manager">{dict.common.roles.manager}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{dict.users.addressLabel}</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. New Cairo, Street 15"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">{dict.users.verified}</Label>
            </div>
            <Switch checked={phoneVerified} onCheckedChange={setPhoneVerified} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving} className="w-full">
            {saving ? dict.common.creating : dict.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
