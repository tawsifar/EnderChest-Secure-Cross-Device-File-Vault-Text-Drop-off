import { createClient } from '@supabase/supabase-js';

async function test() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data } = await supabase.from('room_files').select('*').order('created_at', { ascending: false }).limit(5);
  console.log(data);
}
test();
