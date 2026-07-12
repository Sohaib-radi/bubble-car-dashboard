'use client';

import { useState } from 'react';
import type { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useDictionary } from '@/components/i18n-provider';

export function BulkMessageDialog({
  supabase,
  recipientIds,
  senderId,
  open,
  onOpenChange,
  onSent,
}: {
  supabase: ReturnType<typeof createClient>;
  recipientIds: string[];
  senderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent: () => void;
}) {
  const dict = useDictionary();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSend() {
    if (!message.trim()) {
      toast.error(dict.users.bulkMessageRequired);
      return;
    }
    setSending(true);
    const { error } = await supabase.from('message_broadcasts').insert({
      sender_id: senderId,
      recipient_ids: recipientIds,
      recipient_count: recipientIds.length,
      message: message.trim(),
    });

    if (error) {
      toast.error(dict.users.bulkMessageFailed, { description: error.message });
      setSending(false);
      return;
    }

    toast.success(dict.users.bulkMessageQueued.replace('{n}', String(recipientIds.length)));
    setSending(false);
    setMessage('');
    onOpenChange(false);
    onSent();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{dict.users.bulkMessageTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {dict.users.bulkMessageRecipients.replace('{n}', String(recipientIds.length))}
          </p>
          <Textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={dict.users.bulkMessagePlaceholder}
          />
          <p className="text-xs text-muted-foreground">{dict.users.bulkMessageHint}</p>
        </div>
        <DialogFooter>
          <Button onClick={handleSend} disabled={sending || recipientIds.length === 0}>
            {sending ? dict.users.bulkMessageSending : dict.users.bulkMessageSend}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
