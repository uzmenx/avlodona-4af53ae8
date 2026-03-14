
import { createClient } from '@supabase/supabase-client';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdateMember(id, updates) {
  const { data, error } = await supabase
    .from('family_tree_members')
    .update(updates)
    .eq('id', id)
    .select();
  
  if (error) {
    console.error('Update failed:', error);
  } else {
    console.log('Update success:', data);
  }
}

// Mocking the scenario
const memberId = 'REPLACE_WITH_ACTUAL_ID';
testUpdateMember(memberId, { birth_year: 1990, death_year: 2020 });
