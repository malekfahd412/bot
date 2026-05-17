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
  crew_role: 'owner' | 'officer' | 'member';
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
  level: number;
  bank_balance: number;
  reputation: number;
  territories_owned: string;
  total_heists: number;
  total_earnings: number;
  member_count: number;
  created_at: string;
}

export interface Territory {
  id: string;
  name: string;
  income_per_hour: number;
  control_crew_id: string | null;
  risk_level: 'low' | 'medium' | 'high';
  last_contested: string | null;
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

export interface AdminLog {
  id: string;
  admin_id: string;
  action_type: string;
  target: string | null;
  details: string | null;
  before_snapshot: string | null;
  created_at: string;
}

export interface Season {
  id: number;
  name: string;
  status: 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
  results: string | null;
}

export interface CrewTransaction {
  id: string;
  crew_id: string;
  type: 'deposit' | 'withdraw' | 'heist_reward' | 'territory_income' | 'upgrade_purchase';
  amount: number;
  description: string;
  actor_id: string;
  created_at: string;
}

export interface CrewWar {
  id: string;
  attacker_crew_id: string;
  defender_crew_id: string;
  status: 'pending' | 'active' | 'ended';
  attacker_score: number;
  defender_score: number;
  winner_crew_id: string | null;
  started_at: string;
  ended_at: string | null;
}

export interface CrewUpgrade {
  id: string;
  crew_id: string;
  upgrade_key: string;
  purchased_at: string;
}
