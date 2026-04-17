
insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true)
on conflict (id) do nothing;

create policy "post-images public read"
on storage.objects for select
using (bucket_id = 'post-images');

create policy "post-images auth insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "post-images owner delete"
on storage.objects for delete to authenticated
using (bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text);
