import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabaseAnonKey } from "./env";
import type { Database } from "@/types/database";

// createClient throws on an empty URL, which would happen at import time and
// blank the whole page before React can render an explanation. Fall back to a
// dummy URL so the app can boot and show the missing-config screen instead.
export const supabase = createClient<Database>(
  supabaseUrl || "http://localhost",
  supabaseAnonKey || "missing-anon-key",
);
