/**
 * Cliente Supabase compartilhado por app e teclado.
 *
 * A sessão de login é salva no MMKV — o mesmo armazenamento que o teclado lê.
 * Como app e teclado rodam no mesmo processo, entrar no app já deixa o
 * teclado logado.
 */
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config/supabase';
import { storage } from '../storage/storage';

const mmkvAuthStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: mmkvAuthStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Só na web o login volta pela URL da página; no celular volta por keycon://auth-callback (handleAuthUrl)
    detectSessionInUrl: Platform.OS === 'web',
  },
});
