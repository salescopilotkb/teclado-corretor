/**
 * Acesso válido ao Google Agenda/Meet. O token do Google dura ~1 hora; quando
 * está para vencer, renova pela Edge Function "google-refresh" do Supabase (o
 * Client Secret fica lá, nunca no app). Sem renovação possível, devolve
 * undefined e quem chama abre o Google Meet no navegador.
 */
import { supabase } from '../services/supabase';
import { createGoogleCalendarMeet } from './googleMeet';
import type { GoogleMeetCreateParams, GoogleMeetResult } from './googleMeet';
import { Repo } from '../storage/storage';

/** Renova com 2 minutos de folga, para não falhar no meio da criação da reunião. */
const MARGIN_MS = 2 * 60 * 1000;

export async function getValidGoogleAccessToken(force = false): Promise<string | undefined> {
  const token = Repo.getGoogleAccessToken();
  if (token && !force && Repo.getGoogleExpiry() - MARGIN_MS > Date.now()) return token;

  const refreshToken = Repo.getGoogleRefreshToken();
  if (!refreshToken) return force ? undefined : token;
  try {
    const { data, error } = await supabase.functions.invoke<{ access_token?: string; expires_in?: number; error?: string }>(
      'google-refresh',
      { body: { refresh_token: refreshToken } },
    );
    if (error || !data?.access_token) {
      // A pessoa tirou o acesso do KEYCON na conta Google: precisa conectar de novo
      if (data?.error === 'invalid_grant') Repo.clearGoogleAccessToken();
      return undefined;
    }
    Repo.setGoogleAccessToken(data.access_token, data.expires_in ?? 3600);
    return data.access_token;
  } catch {
    return undefined;
  }
}

/**
 * Cria a reunião com um token válido; se o Google recusar (token vencido ou
 * revogado), renova uma vez e tenta de novo. Sem acesso, lança erro e quem
 * chama abre o Google Meet no navegador.
 */
export async function createMeetWithGoogle(params: GoogleMeetCreateParams): Promise<GoogleMeetResult> {
  const token = await getValidGoogleAccessToken();
  if (!token) throw new Error('no_google_access');
  try {
    return await createGoogleCalendarMeet(params, token);
  } catch (e) {
    const fresh = await getValidGoogleAccessToken(true);
    if (!fresh) throw e;
    return createGoogleCalendarMeet(params, fresh);
  }
}
