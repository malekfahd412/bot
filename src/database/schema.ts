export interface Player {
  id: string;
  discord_id: string;
  display_name: string;
  avatar_url: string | null;
  level: number;
  xp: number;
  coins: number;
  rank: string;
  total_heists: number;
  successful_heists: number;
  failed_heists: number;
  total_earnings: number;
  hardest_heist: string | null;
  streak_current: number;
  streak_longest: number;
  last_daily: string | null;
  last_heist: string | null;
  crew_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface HeistSubmission {
  id: string;
  submitter_id: string;
  heist_name: string;
  difficulty: string;
  teammates: string;
  proof_url: string;
  notes: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_id: string | null;
  reviewer_note: string | null;
  xp_awarded: number | null;
  coins_awarded: number | null;
  review_message_id: string | null;
  submission_channel_id: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Crew {
  id: string;
  name: string;
  tag: string;
  owner_id: string;
  description: string | null;
  icon_url: string | null;
  total_heists: number;
  total_earnings: number;
  member_count: number;
  created_at: string;
}

export interface Achievement {
  id: string;
  player_id: string;
  achievement_key: string;
  achievement_name: string;
  description: string;
  icon: string;
  unlocked_at: string;
}

export interface InventoryItem {
  id: string;
  player_id: string;
  item_key: string;
  item_name: string;
  item_type: string;
  quantity: number;
  acquired_at: string;
}
