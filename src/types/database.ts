// Mooves database types — replace with Supabase CLI generated types later:
//   npx supabase login
//   npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts

export interface UserRow {
  id: string
  phone: string
  display_name: string | null
  avatar_url: string | null
  referral_code: string
  is_available: boolean
  status_note: string | null
  visible_to: string[] | null
  status_set_at: string | null
  onboarding_complete: boolean
  created_at: string
}

export interface FriendshipRow {
  user_id: string
  friend_id: string
  created_at: string
}

export interface GroupRow {
  id: string
  owner_id: string
  name: string
  emoji: string
  created_at: string
}

export interface GroupMemberRow {
  group_id: string
  user_id: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Database = Record<string, any>
