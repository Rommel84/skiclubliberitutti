import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const resetCoachPassword = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), password: z.string().min(6).max(128) }))
  .handler(async ({ data, context }) => {
    const { data: allowed, error } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (error || !allowed) throw new Error('Operazione non consentita.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const result = await supabaseAdmin.auth.admin.updateUserById(data.id, { password: data.password });
    if (result.error) throw new Error('Impossibile aggiornare la password.');
    const update = await supabaseAdmin.from('profiles').update({ reset_requested: false }).eq('id', data.id);
    if (update.error) throw new Error('Password aggiornata, ma richiesta di recupero non chiusa.');
    return { ok: true };
  });