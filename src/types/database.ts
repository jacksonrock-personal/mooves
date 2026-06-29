// Auto-generated types live here once you run: npx supabase gen types typescript
// For now this is the hand-written version matching the PRD schema exactly.
// Replace with the generated version after you've run migrations.

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string                    // UUID — matches auth.users.id
          phone: string
          display_name: string | null
          avatar_url: string | null
          referral_code: string         // 8-char alphanumeric
          is_available: boolean
          status_note: string | null    // max 60 chars
          visible_to: string[] | null   // array of group UUIDs; null = everyone
          status_set_at: string | null  // ISO timestamp
          onboarding_complete: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      friendships: {
        Row: {
          user_id: string
          friend_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['friendships']['Row'], 'created_at'>
        Update: never
      }
      groups: {
        Row: {
          id: string
          owner_id: string
          name: string
          emoji: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['groups']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['groups']['Insert']>
      }
      group_members: {
        Row: {
          group_id: string
          user_id: string
        }
        Insert: Database['public']['Tables']['group_members']['Row']
        Update: never
      }
    }
  }
}

// Convenience aliases
export type UserRow       = Database['public']['Tables']['users']['Row']
export type FriendshipRow = Database['public']['Tables']['friendships']['Row']
export type GroupRow      = Database['public']['Tables']['groups']['Row']
export type GroupMemberRow= Database['public']['Tables']['group_members']['Row']
