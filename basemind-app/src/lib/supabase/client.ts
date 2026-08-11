import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "./env";
import type { Database } from "@/types/database";

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

export const isSupabaseInitialized = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};
