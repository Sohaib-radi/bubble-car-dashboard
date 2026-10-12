-- Payment proof (receipt screenshot) for bookings.
-- The customer app uploads the image to the private `payment-proofs` bucket
-- under `<user id>/<booking id>.<ext>` and stores that path on the booking.
-- Staff see it in Dashboard → Overview → manage reservation.

alter table public.bookings add column if not exists payment_proof_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

drop policy if exists "Customers upload own payment proofs" on storage.objects;
create policy "Customers upload own payment proofs" on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Owner or staff view payment proofs" on storage.objects;
create policy "Owner or staff view payment proofs" on storage.objects for select
  to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff_or_manager(auth.uid())
    )
  );
