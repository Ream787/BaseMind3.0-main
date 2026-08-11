// Extract Supabase configuration from environment variables
const trimTrailingSlash = (url: string) => url.replace(/\/+$|\s+$/g, '');
export const supabaseUrl = trimTrailingSlash(import.meta.env.VITE_SUPABASE_URL || '');
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// For backward compatibility with existing code
export const projectId = supabaseUrl.replace('https://', '').replace('.supabase.co', '');
export const publicAnonKey = supabaseAnonKey;

// Gemini API Key
// App URL - must be set via Vercel environment variables
export const appUrl = import.meta.env.VITE_APP_URL || '';

// Validate configuration
export const validateConfig = () => {
  const missing = [];
  if (!supabaseUrl) missing.push('VITE_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('VITE_SUPABASE_ANON_KEY');
  if (!appUrl) missing.push('VITE_APP_URL');
  if (missing.length > 0) {
    const errorMessage = `Missing required environment variables: ${missing.join(', ')}. Make sure these are set in Vercel environment variables.`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
};
