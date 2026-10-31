-- Sincronizzazione immediata: notifiche in tempo reale sulle modifiche al registro
-- e salvataggio con controllo di versione (nessuna modifica persa se due dispositivi salvano insieme).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'register_state') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.register_state;
  END IF;
END $$;

-- Salva solo se nessun altro ha salvato nel frattempo (base_version = versione attuale).
-- Risponde {"ok":true,"version":n} oppure {"ok":false,"version":versione_attuale}.
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
