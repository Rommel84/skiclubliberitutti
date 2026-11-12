CREATE OR REPLACE FUNCTION public.is_coach_approved() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND status='approved'))
$$;
REVOKE ALL ON FUNCTION public.is_coach_approved() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_coach_approved() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_register_state(with_data boolean DEFAULT true)
RETURNS TABLE(version bigint, data jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_coach_approved() THEN RAISE EXCEPTION 'not approved'; END IF;
  RETURN QUERY SELECT s.version, CASE WHEN with_data THEN s.data ELSE NULL END FROM public.register_state s WHERE s.id=1;
END $$;

CREATE OR REPLACE FUNCTION public.get_register_backup(backup_id uuid)
RETURNS TABLE(id uuid, created_at timestamptz, data jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_coach_approved() THEN RAISE EXCEPTION 'not approved'; END IF;
  RETURN QUERY SELECT b.id, b.created_at, b.data FROM public.register_backups b WHERE b.id=backup_id;
END $$;

CREATE OR REPLACE FUNCTION public.list_register_backups()
RETURNS TABLE(id uuid, created_at timestamptz, kind text, label text, n_ses integer, n_ath integer, size_kb integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_coach_approved() THEN RAISE EXCEPTION 'not approved'; END IF;
  RETURN QUERY SELECT b.id, b.created_at, b.kind, b.label,
    CASE WHEN jsonb_typeof(b.data->'ses')='array' THEN jsonb_array_length(b.data->'ses') ELSE 0 END,
    CASE WHEN jsonb_typeof(b.data->'ath')='array' THEN jsonb_array_length(b.data->'ath') ELSE 0 END,
    (pg_column_size(b.data)/1024)::int
  FROM public.register_backups b ORDER BY b.created_at DESC LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION public.delete_manual_backup(backup_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_coach_approved() THEN RAISE EXCEPTION 'not approved'; END IF;
  DELETE FROM public.register_backups WHERE id=backup_id AND kind IN ('manual','pre_restore');
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.make_manual_backup(note text DEFAULT NULL, backup_kind text DEFAULT 'manual') RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE nid uuid; k text; keep int;
BEGIN
  IF NOT public.is_coach_approved() THEN RAISE EXCEPTION 'not approved'; END IF;
  k := CASE WHEN backup_kind='pre_restore' THEN 'pre_restore' ELSE 'manual' END;
  keep := CASE WHEN k='manual' THEN 60 ELSE 20 END;
  INSERT INTO public.register_backups(data,kind,label) SELECT data,k,NULLIF(left(btrim(coalesce(note,'')),80),'') FROM public.register_state WHERE id=1 RETURNING id INTO nid;
  IF nid IS NULL THEN RAISE EXCEPTION 'no data'; END IF;
  DELETE FROM public.register_backups WHERE id IN (SELECT id FROM public.register_backups WHERE kind=k ORDER BY created_at DESC OFFSET keep);
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.save_register(new_data jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v bigint;
BEGIN
  IF NOT public.is_coach_approved() THEN RAISE EXCEPTION 'not approved'; END IF;
  IF jsonb_typeof(new_data)<>'object' THEN RAISE EXCEPTION 'invalid data'; END IF;
  INSERT INTO public.register_state(id,data,version,updated_at) VALUES(1,new_data,1,now())
  ON CONFLICT (id) DO UPDATE SET data=excluded.data, version=register_state.version+1, updated_at=now() RETURNING version INTO v;
  RETURN v;
END $$;

CREATE OR REPLACE FUNCTION public.save_register_if(new_data jsonb, base_version bigint) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v bigint; cur bigint;
BEGIN
  IF NOT public.is_coach_approved() THEN RAISE EXCEPTION 'not approved'; END IF;
  IF jsonb_typeof(new_data)<>'object' THEN RAISE EXCEPTION 'invalid data'; END IF;
  UPDATE public.register_state SET data=new_data, version=version+1, updated_at=now() WHERE id=1 AND version=base_version RETURNING version INTO v;
  IF v IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'version',v); END IF;
  SELECT version INTO cur FROM public.register_state WHERE id=1;
  IF cur IS NULL THEN
    INSERT INTO public.register_state(id,data,version,updated_at) VALUES(1,new_data,1,now()) ON CONFLICT (id) DO NOTHING RETURNING version INTO v;
    IF v IS NOT NULL THEN RETURN jsonb_build_object('ok',true,'version',v); END IF;
    SELECT version INTO cur FROM public.register_state WHERE id=1;
  END IF;
  RETURN jsonb_build_object('ok',false,'version',cur);
END $$;

REVOKE ALL ON FUNCTION public.get_register_state(boolean), public.get_register_backup(uuid), public.list_register_backups(), public.delete_manual_backup(uuid), public.make_manual_backup(text,text), public.save_register(jsonb), public.save_register_if(jsonb,bigint), public.make_register_backup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_register_state(boolean), public.get_register_backup(uuid), public.list_register_backups(), public.delete_manual_backup(uuid), public.make_manual_backup(text,text), public.save_register(jsonb), public.save_register_if(jsonb,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.coach_pin_ok(pin text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_role(auth.uid(),'admin') OR (public.is_coach_approved() AND pin='2525')
$$;
REVOKE ALL ON FUNCTION public.coach_pin_ok(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.coach_pin_ok(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_coach_requests(pin text)
RETURNS TABLE(id uuid, email text, status text, requested_at timestamptz) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.coach_pin_ok(pin) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN QUERY SELECT p.id, p.email, CASE WHEN public.has_role(p.id,'admin') THEN 'owner' ELSE p.status END, p.requested_at FROM public.profiles p ORDER BY p.requested_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.list_coach_requests(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_coach_requests(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decide_coach_pin(target_id uuid, decision text, pin text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.coach_pin_ok(pin) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF target_id=auth.uid() OR public.has_role(target_id,'admin') THEN RAISE EXCEPTION 'Cannot change this account'; END IF;
  IF decision NOT IN ('approved','rejected','revoked') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  UPDATE public.profiles SET status=decision, decided_at=now(), decided_by=auth.uid() WHERE id=target_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.decide_coach_pin(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_coach_pin(uuid,text,text) TO authenticated;