import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from './info';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Helper function to check if Supabase is initialized
export const isSupabaseInitialized = (): boolean => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Helper to handle Supabase errors
export interface SupabaseError {
  message: string;
  status?: number;
  code?: string;
}

export const handleSupabaseError = (error: any): SupabaseError => {
  if (error?.message) {
    return {
      message: error.message,
      status: error.status,
      code: error.code,
    };
  }
  return {
    message: 'An unknown error occurred',
  };
};
