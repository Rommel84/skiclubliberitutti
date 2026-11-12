DROP POLICY IF EXISTS "register readable" ON public.register_state;
DROP POLICY IF EXISTS "backups readable" ON public.register_backups;
REVOKE SELECT ON public.register_state FROM anon, authenticated;
REVOKE SELECT ON public.register_backups FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_register_state(with_data boolean DEFAULT true)
RETURNS TABLE(version bigint, data jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.version, CASE WHEN with_data THEN s.data ELSE NULL END
  FROM public.register_state s WHERE s.id = 1
$$;

CREATE OR REPLACE FUNCTION public.get_register_backup(backup_id uuid)
RETURNS TABLE(id uuid, created_at timestamptz, data jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.created_at, b.data FROM public.register_backups b WHERE b.id = backup_id
$$;

GRANT EXECUTE ON FUNCTION public.get_register_state(boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_register_backup(uuid) TO anon, authenticated;