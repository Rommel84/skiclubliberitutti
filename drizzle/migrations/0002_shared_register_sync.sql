CREATE TABLE public.register_state (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.register_state TO anon, authenticated;
GRANT ALL ON public.register_state TO service_role;
ALTER TABLE public.register_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "register readable" ON public.register_state FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.register_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL,
  emailed_at timestamptz
);
GRANT SELECT ON public.register_backups TO anon, authenticated;
GRANT ALL ON public.register_backups TO service_role;
ALTER TABLE public.register_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backups readable" ON public.register_backups FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.save_register(new_data jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v bigint;
BEGIN
  IF jsonb_typeof(new_data) <> 'object' THEN RAISE EXCEPTION 'invalid data'; END IF;
  INSERT INTO public.register_state(id, data, version, updated_at) VALUES (1, new_data, 1, now())
  ON CONFLICT (id) DO UPDATE SET data = excluded.data, version = register_state.version + 1, updated_at = now()
  RETURNING version INTO v;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.save_register(jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.save_register(jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.make_register_backup()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nid uuid;
BEGIN
  INSERT INTO public.register_backups(data) SELECT data FROM public.register_state WHERE id = 1 RETURNING id INTO nid;
  DELETE FROM public.register_backups WHERE created_at < now() - interval '120 days';
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.make_register_backup() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.make_register_backup() TO service_role;