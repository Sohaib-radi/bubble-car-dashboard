'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Eye, Pencil, Trash2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDictionary } from '@/components/i18n-provider';
import { EditUserDialog } from './edit-user-dialog';
import { UserDetailsDialog } from './user-details-dialog';
import { BulkMessageDialog } from './bulk-message-dialog';
import type { Profile, Role } from './types';

const ROLE_VARIANT: Record<Role, 'secondary' | 'default' | 'destructive'> = {
  customer: 'secondary',
  staff: 'default',
  manager: 'destructive',
};

export default function UsersPage() {
  const dict = useDictionary();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [verifiedFilter, setVerifiedFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<Profile | null>(null);
  const [bulkMessageOpen, setBulkMessageOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, phone, address, role, phone_verified, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        toast.error(dict.users.loadFailed, { description: error.message });
      } else {
        setProfiles(data ?? []);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  async function handleRoleChange(id: string, role: Role) {
    const previous = profiles;
    setProfiles((p) => p.map((profile) => (profile.id === id ? { ...profile, role } : profile)));

    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);

    if (error) {
      setProfiles(previous);
      toast.error(dict.users.roleUpdateFailed, { description: error.message });
    } else {
      toast.success(dict.users.roleUpdated);
    }
  }

  async function handleDelete(profile: Profile) {
    const name = profile.full_name || profile.phone || '';
    if (!confirm(dict.users.deleteConfirm.replace('{name}', name))) return;

    const res = await fetch(`/api/admin/users/${profile.id}`, { method: 'DELETE' });
    if (res.redirected || !res.ok) {
      const body = res.redirected
        ? {}
        : await res.json().catch(() => ({}) as { error?: string });
      toast.error(dict.users.deleteFailed, { description: body.error });
      return;
    }

    setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(profile.id);
      return next;
    });
    toast.success(dict.users.deletedToast);
  }

  function handleEditSaved(id: string, patch: Partial<Profile>) {
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  const filtered = profiles.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q || p.full_name.toLowerCase().includes(q) || (p.phone ?? '').toLowerCase().includes(q);
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    const matchesVerified =
      verifiedFilter === 'all' ||
      (verifiedFilter === 'verified' ? p.phone_verified : !p.phone_verified);
    return matchesSearch && matchesRole && matchesVerified;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      if (allFilteredSelected) return new Set();
      const next = new Set(prev);
      filtered.forEach((p) => next.add(p.id));
      return next;
    });
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder={dict.users.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{dict.users.allRoles}</SelectItem>
            <SelectItem value="customer">{dict.common.roles.customer}</SelectItem>
            <SelectItem value="staff">{dict.common.roles.staff}</SelectItem>
            <SelectItem value="manager">{dict.common.roles.manager}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={verifiedFilter}
          onValueChange={(v) => setVerifiedFilter(v as 'all' | 'verified' | 'unverified')}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{dict.users.allVerified}</SelectItem>
            <SelectItem value="verified">{dict.users.verifiedOnly}</SelectItem>
            <SelectItem value="unverified">{dict.users.unverifiedOnly}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border bg-accent/40 px-4 py-2.5">
          <span className="text-sm font-medium">
            {dict.users.selectedCount.replace('{n}', String(selectedIds.size))}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="size-3.5" />
              {dict.users.clearSelection}
            </Button>
            <Button size="sm" className="gap-2" onClick={() => setBulkMessageOpen(true)}>
              <Send className="size-4" />
              {dict.users.sendMessage}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-md shadow-black/[0.04]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label={dict.users.selectedCount.replace('{n}', String(selectedIds.size))}
                />
              </TableHead>
              <TableHead>{dict.users.name}</TableHead>
              <TableHead>{dict.users.phone}</TableHead>
              <TableHead>{dict.users.verified}</TableHead>
              <TableHead>{dict.users.joined}</TableHead>
              <TableHead>{dict.users.role}</TableHead>
              <TableHead className="text-end">{dict.users.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-6 w-full" />
                  </TableCell>
                </TableRow>
              ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {dict.users.noUsers}
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              filtered.map((p) => (
                <TableRow key={p.id} data-state={selectedIds.has(p.id) ? 'selected' : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleSelectOne(p.id)}
                      aria-label={p.full_name}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{p.full_name || '—'}</TableCell>
                  <TableCell>{p.phone ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={p.phone_verified ? 'default' : 'secondary'}>
                      {p.phone_verified ? dict.users.verifiedBadge : dict.users.unverifiedBadge}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={p.role}
                      onValueChange={(role) => handleRoleChange(p.id, role as Role)}
                      disabled={p.id === currentUserId}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue>
                          <Badge variant={ROLE_VARIANT[p.role]}>
                            {dict.common.roles[p.role]}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">{dict.common.roles.customer}</SelectItem>
                        <SelectItem value="staff">{dict.common.roles.staff}</SelectItem>
                        <SelectItem value="manager">{dict.common.roles.manager}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={dict.users.viewDetails}
                        onClick={() => setDetailsTarget(p)}
                      >
                        <Eye className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={dict.users.editUser}
                        onClick={() => setEditTarget(p)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={dict.users.deleteUser}
                        disabled={p.id === currentUserId}
                        onClick={() => handleDelete(p)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {editTarget && (
        <EditUserDialog
          profile={editTarget}
          supabase={supabase}
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSaved={handleEditSaved}
        />
      )}

      {detailsTarget && (
        <UserDetailsDialog
          profile={detailsTarget}
          supabase={supabase}
          open={!!detailsTarget}
          onOpenChange={(open) => !open && setDetailsTarget(null)}
        />
      )}

      <BulkMessageDialog
        supabase={supabase}
        recipientIds={Array.from(selectedIds)}
        senderId={currentUserId}
        open={bulkMessageOpen}
        onOpenChange={setBulkMessageOpen}
        onSent={() => setSelectedIds(new Set())}
      />
    </div>
  );
}
