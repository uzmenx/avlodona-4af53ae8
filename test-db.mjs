import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  // Try to authenticate. Since we don't have the user's password, we might need a session.
  // Actually, we can't easily authenticate as the user without their token.
  // But maybe we can read the schema using anon key.
  const { data, error } = await supabase.from('node_positions').select('*').limit(1);
  console.log("SELECT test:", { data, error });
}

test();
