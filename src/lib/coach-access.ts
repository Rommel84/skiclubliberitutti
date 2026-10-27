import { supabase } from '@/integrations/supabase/client';
import { resetCoachPassword } from './coach-access.functions';

export async function coachSnapshot() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) return { user: null, requests: [] };
  if (error) throw error;
  const profile = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (profile.error) throw profile.error;
  const roles = await supabase.from('user_roles').select('role').eq('user_id', user.id);
  if (roles.error) throw roles.error;
  const admin = roles.data.some(r => r.role === 'admin');
  let requests: typeof profile.data[] = [];
  if (admin) {
    const result = await supabase.from('profiles').select('*').order('requested_at', { ascending: false });
    if (result.error) throw result.error;
    requests = result.data;
  }
  return { user: { ...profile.data, nome: `${profile.data.first_name} ${profile.data.last_name}`.trim(), admin }, requests };
}

export const coachBridge = {
  snapshot: coachSnapshot,
  async login(email: string, password: string) {
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.error) throw new Error('Email o password non valide, oppure email non ancora confermata.');
    return coachSnapshot();
  },
  async register(email: string, first_name: string, last_name: string, password: string) {
    const result = await supabase.auth.signUp({ email, password, options: { data: { first_name, last_name }, emailRedirectTo: window.location.origin } });
    if (result.error) throw new Error('Registrazione non riuscita. Riprova tra poco o accedi se hai già un account.');
    return { confirmed: !!result.data.session };
  },
  async logout() { const result = await supabase.auth.signOut(); if (result.error) throw result.error; },
  async decide(id: string, decision: string) {
    const result = await supabase.rpc('decide_coach_request', { target_id: id, decision });
    if (result.error) throw new Error('Non è stato possibile aggiornare la richiesta.');
    return coachSnapshot();
  },
  async forgot(email: string) {
    const result = await supabase.rpc('request_coach_password_reset', { coach_email: email });
    if (result.error) throw new Error('Richiesta non inviata. Riprova tra poco.');
  },
  async changePassword(current_password: string, password: string) {
    const result = await supabase.auth.updateUser({ password, current_password });
    if (result.error) throw new Error('Password non aggiornata: verifica quella attuale e riprova.');
  },
  async resetPassword(id: string, password: string) { await resetCoachPassword({ data: { id, password } }); return coachSnapshot(); },
};