ALTER TABLE public.register_backups
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS label text;
ALTER TABLE public.register_backups DROP CONSTRAINT IF EXISTS register_backups_kind_check;
ALTER TABLE public.register_backups
  ADD CONSTRAINT register_backups_kind_check CHECK (kind IN ('auto', 'manual', 'pre_restore'));
CREATE INDEX IF NOT EXISTS register_backups_created_at_idx ON public.register_backups (created_at DESC);

CREATE OR REPLACE FUNCTION public.make_register_backup()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nid uuid;
BEGIN
  INSERT INTO public.register_backups(data, kind) SELECT data, 'auto' FROM public.register_state WHERE id = 1 RETURNING id INTO nid;
  DELETE FROM public.register_backups WHERE kind = 'auto' AND created_at < now() - interval '120 days';
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.make_register_backup() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.make_register_backup() TO service_role;

CREATE OR REPLACE FUNCTION public.make_manual_backup(note text DEFAULT NULL, backup_kind text DEFAULT 'manual')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nid uuid; k text; keep int;
BEGIN
  k := CASE WHEN backup_kind = 'pre_restore' THEN 'pre_restore' ELSE 'manual' END;
  keep := CASE WHEN k = 'manual' THEN 60 ELSE 20 END;
  INSERT INTO public.register_backups(data, kind, label)
    SELECT data, k, NULLIF(left(btrim(coalesce(note, '')), 80), '') FROM public.register_state WHERE id = 1
    RETURNING id INTO nid;
  IF nid IS NULL THEN RAISE EXCEPTION 'no data'; END IF;
  DELETE FROM public.register_backups WHERE id IN (
    SELECT id FROM public.register_backups WHERE kind = k ORDER BY created_at DESC OFFSET keep);
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.make_manual_backup(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.make_manual_backup(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.list_register_backups()
RETURNS TABLE(id uuid, created_at timestamptz, kind text, label text, n_ses int, n_ath int, size_kb int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.created_at, b.kind, b.label,
    CASE WHEN jsonb_typeof(b.data->'ses') = 'array' THEN jsonb_array_length(b.data->'ses') ELSE 0 END,
    CASE WHEN jsonb_typeof(b.data->'ath') = 'array' THEN jsonb_array_length(b.data->'ath') ELSE 0 END,
    (pg_column_size(b.data) / 1024)::int
  FROM public.register_backups b ORDER BY b.created_at DESC LIMIT 200;
$$;
REVOKE ALL ON FUNCTION public.list_register_backups() FROM public;
GRANT EXECUTE ON FUNCTION public.list_register_backups() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_manual_backup(backup_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.register_backups WHERE id = backup_id AND kind IN ('manual', 'pre_restore');
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.delete_manual_backup(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_manual_backup(uuid) TO anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'register_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.register_state;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.save_register_if(new_data jsonb, base_version bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint; cur bigint;
BEGIN
  IF jsonb_typeof(new_data) <> 'object' THEN RAISE EXCEPTION 'invalid data'; END IF;
  UPDATE public.register_state SET data = new_data, version = version + 1, updated_at = now()
    WHERE id = 1 AND version = base_version RETURNING version INTO v;
  IF v IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'version', v); END IF;
  SELECT version INTO cur FROM public.register_state WHERE id = 1;
  IF cur IS NULL THEN
    INSERT INTO public.register_state(id, data, version, updated_at) VALUES (1, new_data, 1, now())
      ON CONFLICT (id) DO NOTHING RETURNING version INTO v;
    IF v IS NOT NULL THEN RETURN jsonb_build_object('ok', true, 'version', v); END IF;
    SELECT version INTO cur FROM public.register_state WHERE id = 1;
  END IF;
  RETURN jsonb_build_object('ok', false, 'version', cur);
END $$;
REVOKE ALL ON FUNCTION public.save_register_if(jsonb, bigint) FROM public;
GRANT EXECUTE ON FUNCTION public.save_register_if(jsonb, bigint) TO anon, authenticated;