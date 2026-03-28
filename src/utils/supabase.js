import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;

function getClient() {
  if (!supabase && supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabase;
}

export async function submitScore({ player_name, score, distance, coins, character_id }) {
  const client = getClient();
  if (!client) throw new Error('Supabase not configured');

  const { error } = await client
    .from('safari_leaderboard')
    .insert([{ player_name, score, distance, coins, character_id }]);

  if (error) throw error;
}

export async function getTopScores(limit = 10) {
  const client = getClient();
  if (!client) return [];

  const { data, error } = await client
    .from('safari_leaderboard')
    .select('id, player_name, score, distance, coins, character_id, created_at')
    .order('score', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function getPlayerRank(playerName) {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from('safari_leaderboard')
    .select('score')
    .gt('score', 0);

  if (error || !data) return null;

  const { data: myScores } = await client
    .from('safari_leaderboard')
    .select('score')
    .eq('player_name', playerName)
    .order('score', { ascending: false })
    .limit(1);

  if (!myScores?.length) return null;
  const myBest = myScores[0].score;
  const rank = data.filter(r => r.score > myBest).length + 1;
  return rank;
}
