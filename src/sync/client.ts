import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Null when the app runs without a backend (local-only mode). */
export const supabase: SupabaseClient | null =
  URL && ANON
    ? createClient(URL, ANON, {
        auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
      })
    : null;

export const SUPABASE_URL = URL;
export const SUPABASE_ANON_KEY = ANON;
