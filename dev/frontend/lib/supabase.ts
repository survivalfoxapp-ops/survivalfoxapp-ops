import { createClient } from "@supabase/supabase-js";

// Diese Variablen müssen im Browser verfügbar sein
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Klare, frühe Fehlermeldung bei Fehlkonfiguration
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Supabase config missing: Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

// Singleton-Client für das Frontend
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false, // wichtig für reines Functions-Frontend
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
