// Hand-written types matching the Mooves schema.
// Replace with `npx supabase gen types typescript` output once Supabase CLI is set up.

export type UserRow = {
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

export type UserInsert = Partial<Omit<UserRow, 'id' | 'created_at'>> & { phone: string }
export type UserUpdate = Partial<Omit<UserRow, 'id' | 'created_at' | 'phone'>>

export type FriendshipRow = {
  user_id: string
  friend_id: string
  created_at: string
}

export type GroupRow = {
  id: string
  owner_id: string
  name: string
  emoji: string
  created_at: string
}

export type GroupMemberRow = {
  group_id: string
  user_id: string
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: UserRow
        Insert: UserInsert
        Update: UserUpdate
      }
      friendships: {
        Row: FriendshipRow
        Insert: Omit<FriendshipRow, 'created_at'>
        Update: never
      }
      groups: {
        Row: GroupRow
        Insert: Omit<GroupRow, 'id' | 'created_at'>
        Update: Partial<Omit<GroupRow, 'id' | 'created_at'>>
      }
      group_members: {
        Row: GroupMemberRow
        Insert: GroupMemberRow
        Update: never
      }
    }
  }
}
