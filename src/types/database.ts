export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      availability_slots: {
        Row: {
          created_at: string
          id: string
          part: string
          slot_date: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          part: string
          slot_date: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          part?: string
          slot_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      fof_hidden: {
        Row: {
          created_at: string
          hidden_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          user_id: string
        }
        Insert: {
          group_id: string
          user_id: string
        }
        Update: {
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_notification_mutes: {
        Row: {
          created_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_notification_mutes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_notification_mutes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          emoji: string
          id: string
          invite_code: string | null
          last_notified_at: string | null
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          invite_code?: string | null
          last_notified_at?: string | null
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          invite_code?: string | null
          last_notified_at?: string | null
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      metro_zips: {
        Row: {
          metro_id: string
          zip: string
        }
        Insert: {
          metro_id: string
          zip: string
        }
        Update: {
          metro_id?: string
          zip?: string
        }
        Relationships: [
          {
            foreignKeyName: "metro_zips_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "metro_zips_zip_fkey"
            columns: ["zip"]
            isOneToOne: true
            referencedRelation: "zip_codes"
            referencedColumns: ["zip"]
          },
        ]
      }
      metros: {
        Row: {
          created_at: string
          id: string
          last_successful_pull: string | null
          thin_alerted_at: string | null
          lat: number
          lng: number
          name: string
          radius_miles: number
          state: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_successful_pull?: string | null
          thin_alerted_at?: string | null
          lat: number
          lng: number
          name: string
          radius_miles?: number
          state: string
        }
        Update: {
          created_at?: string
          id?: string
          last_successful_pull?: string | null
          thin_alerted_at?: string | null
          lat?: number
          lng?: number
          name?: string
          radius_miles?: number
          state?: string
        }
        Relationships: []
      }
      move_interested: {
        Row: {
          created_at: string
          move_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          move_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          move_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "move_interested_move_id_fkey"
            columns: ["move_id"]
            isOneToOne: false
            referencedRelation: "sponsored_moves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_interested_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      move_joins: {
        Row: {
          created_at: string
          id: string
          joiner_id: string
          mover_id: string
          plan_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          joiner_id: string
          mover_id: string
          plan_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          joiner_id?: string
          mover_id?: string
          plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "move_joins_joiner_id_fkey"
            columns: ["joiner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_joins_mover_id_fkey"
            columns: ["mover_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "move_joins_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "plan_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          mentions: string[]
          plan_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          plan_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          mentions?: string[]
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_comments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          author_id: string
          cancelled_at: string | null
          created_at: string
          expires_at: string
          has_time: boolean
          id: string
          location_text: string | null
          note: string | null
          show_groups: boolean
          open_to_fof: boolean
          sponsored_move_id: string | null
          start_at: string
          time_mode: string
          title: string
          updated_at: string
          visible_to: string[] | null
          visible_user_ids: string[] | null
        }
        Insert: {
          author_id: string
          cancelled_at?: string | null
          created_at?: string
          expires_at: string
          has_time?: boolean
          id?: string
          location_text?: string | null
          note?: string | null
          show_groups?: boolean
          open_to_fof?: boolean
          sponsored_move_id?: string | null
          start_at: string
          time_mode?: string
          title: string
          updated_at?: string
          visible_to?: string[] | null
          visible_user_ids?: string[] | null
        }
        Update: {
          author_id?: string
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          has_time?: boolean
          id?: string
          location_text?: string | null
          note?: string | null
          show_groups?: boolean
          open_to_fof?: boolean
          sponsored_move_id?: string | null
          start_at?: string
          time_mode?: string
          title?: string
          updated_at?: string
          visible_to?: string[] | null
          visible_user_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "plans_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_sponsored_move_id_fkey"
            columns: ["sponsored_move_id"]
            isOneToOne: false
            referencedRelation: "sponsored_moves"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          fcm_token: string
          id: string
          last_seen_at: string
          platform: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fcm_token: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fcm_token?: string
          id?: string
          last_seen_at?: string
          platform?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: number
          count: number
          expires_at: string
          key: string
        }
        Insert: {
          bucket: number
          count?: number
          expires_at: string
          key: string
        }
        Update: {
          bucket?: number
          count?: number
          expires_at?: string
          key?: string
        }
        Relationships: []
      }
      roundup_members: {
        Row: {
          joined_at: string
          new_friend_ids: string[]
          roundup_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          new_friend_ids?: string[]
          roundup_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          new_friend_ids?: string[]
          roundup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roundup_members_roundup_id_fkey"
            columns: ["roundup_id"]
            isOneToOne: false
            referencedRelation: "roundups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roundup_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      roundups: {
        Row: {
          closed_at: string | null
          code: string
          created_at: string
          expires_at: string
          host_id: string
          id: string
        }
        Insert: {
          closed_at?: string | null
          code: string
          created_at?: string
          expires_at?: string
          host_id: string
          id?: string
        }
        Update: {
          closed_at?: string | null
          code?: string
          created_at?: string
          expires_at?: string
          host_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roundups_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsored_moves: {
        Row: {
          area_zip: string
          brand: string | null
          brought_over_count: number
          category: string
          clicks: number
          created_at: string
          dedupe_key: string | null
          description: string
          id: string
          image_url: string | null
          impressions: number
          interested_count: number
          is_free: boolean | null
          link_url: string | null
          location_text: string | null
          metro_id: string | null
          neighborhood: string | null
          origin: string
          paid_at: string | null
          price_cents: number | null
          price_text: string | null
          radius_miles: number
          reject_reason: string | null
          reviewed_at: string | null
          source_url: string | null
          sponsor_id: string | null
          start_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          time_text: string | null
          title: string
        }
        Insert: {
          area_zip: string
          brand?: string | null
          brought_over_count?: number
          category: string
          clicks?: number
          created_at?: string
          dedupe_key?: string | null
          description: string
          id?: string
          image_url?: string | null
          impressions?: number
          interested_count?: number
          is_free?: boolean | null
          link_url?: string | null
          location_text?: string | null
          metro_id?: string | null
          neighborhood?: string | null
          origin?: string
          paid_at?: string | null
          price_cents?: number | null
          price_text?: string | null
          radius_miles?: number
          reject_reason?: string | null
          reviewed_at?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          start_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          time_text?: string | null
          title: string
        }
        Update: {
          area_zip?: string
          brand?: string | null
          brought_over_count?: number
          category?: string
          clicks?: number
          created_at?: string
          dedupe_key?: string | null
          description?: string
          id?: string
          image_url?: string | null
          impressions?: number
          interested_count?: number
          is_free?: boolean | null
          link_url?: string | null
          location_text?: string | null
          metro_id?: string | null
          neighborhood?: string | null
          origin?: string
          paid_at?: string | null
          price_cents?: number | null
          price_text?: string | null
          radius_miles?: number
          reject_reason?: string | null
          reviewed_at?: string | null
          source_url?: string | null
          sponsor_id?: string | null
          start_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          time_text?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsored_moves_metro_id_fkey"
            columns: ["metro_id"]
            isOneToOne: false
            referencedRelation: "metros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsored_moves_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          business_name: string | null
          created_at: string
          default_payment_method_id: string | null
          email: string | null
          id: string
          phone: string
          stripe_customer_id: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          email?: string | null
          id?: string
          phone: string
          stripe_customer_id?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          email?: string | null
          id?: string
          phone?: string
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      tips: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          stripe_payment_intent_id: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          stripe_payment_intent_id: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          stripe_payment_intent_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          activated_at: string | null
          area_zip: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          fof_mooves_enabled: boolean
          hide_from_matches: boolean
          id: string
          interests: string[] | null
          is_admin: boolean
          is_available: boolean
          last_active_at: string | null
          last_confirm_push_on: string | null
          last_green_at: string | null
          last_wave_at: string | null
          last_week_push_on: string | null
          onboarding_complete: boolean
          phone: string
          recruit_ask_shown_at: string | null
          referral_code: string
          status_expires_at: string | null
          status_move_id: string | null
          status_note: string | null
          status_set_at: string | null
          status_show_groups: boolean
          status_time: string | null
          timezone: string | null
          visible_to: string[] | null
          visible_user_ids: string[] | null
          wave_push_enabled: boolean
          week_push_enabled: boolean
          week_ritual_day: number
          week_visible_to: string[] | null
          week_visible_user_ids: string[] | null
        }
        Insert: {
          activated_at?: string | null
          area_zip?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          fof_mooves_enabled?: boolean
          hide_from_matches?: boolean
          id?: string
          interests?: string[] | null
          is_admin?: boolean
          is_available?: boolean
          last_active_at?: string | null
          last_confirm_push_on?: string | null
          last_green_at?: string | null
          last_wave_at?: string | null
          last_week_push_on?: string | null
          onboarding_complete?: boolean
          phone: string
          recruit_ask_shown_at?: string | null
          referral_code?: string
          status_expires_at?: string | null
          status_move_id?: string | null
          status_note?: string | null
          status_set_at?: string | null
          status_show_groups?: boolean
          status_time?: string | null
          timezone?: string | null
          visible_to?: string[] | null
          visible_user_ids?: string[] | null
          wave_push_enabled?: boolean
          week_push_enabled?: boolean
          week_ritual_day?: number
          week_visible_to?: string[] | null
          week_visible_user_ids?: string[] | null
        }
        Update: {
          activated_at?: string | null
          area_zip?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          fof_mooves_enabled?: boolean
          hide_from_matches?: boolean
          id?: string
          interests?: string[] | null
          is_admin?: boolean
          is_available?: boolean
          last_active_at?: string | null
          last_confirm_push_on?: string | null
          last_green_at?: string | null
          last_wave_at?: string | null
          last_week_push_on?: string | null
          onboarding_complete?: boolean
          phone?: string
          recruit_ask_shown_at?: string | null
          referral_code?: string
          status_expires_at?: string | null
          status_move_id?: string | null
          status_note?: string | null
          status_set_at?: string | null
          status_show_groups?: boolean
          status_time?: string | null
          timezone?: string | null
          visible_to?: string[] | null
          visible_user_ids?: string[] | null
          wave_push_enabled?: boolean
          week_push_enabled?: boolean
          week_ritual_day?: number
          week_visible_to?: string[] | null
          week_visible_user_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "users_status_move_id_fkey"
            columns: ["status_move_id"]
            isOneToOne: false
            referencedRelation: "sponsored_moves"
            referencedColumns: ["id"]
          },
        ]
      }
      zip_codes: {
        Row: {
          city: string | null
          lat: number
          lng: number
          state: string | null
          zip: string
        }
        Insert: {
          city?: string | null
          lat: number
          lng: number
          state?: string | null
          zip: string
        }
        Update: {
          city?: string | null
          lat?: number
          lng?: number
          state?: string | null
          zip?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      availability_cron_tick: { Args: never; Returns: undefined }
      can_see_week: { Args: { viewer: string; target: string }; Returns: boolean }
      friend_week_counts: {
        Args: { viewer: string }
        Returns: {
          friend_id: string
          slot_count: number
        }[]
      }
      generate_referral_code: { Args: never; Returns: string }
      get_feed: { Args: { viewer: string }; Returns: Json }
      get_friend_week: { Args: { viewer: string; target: string }; Returns: Json }
      get_plans: { Args: { viewer: string }; Returns: Json }
      green_wave_candidates: {
        Args: { mover: string }
        Returns: {
          green_count: number
          green_names: string[]
          time_bucket: string
          viewer: string
        }[]
      }
      increment_brought_over: {
        Args: { p_move_id: string }
        Returns: undefined
      }
      increment_move_impressions: {
        Args: { move_ids: string[] }
        Returns: undefined
      }
      nearby_zips: {
        Args: { p_radius_miles?: number; p_zip: string }
        Returns: {
          zip: string
        }[]
      }
      nearest_zip: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          city: string
          state: string
          zip: string
        }[]
      }
      plan_taggable_friends: {
        Args: { p_plan: string; p_viewer: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      purge_old_availability_slots: { Args: never; Returns: undefined }
      rate_limit_hit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      record_move_click: {
        Args: { p_move_id: string }
        Returns: {
          link_url: string
        }[]
      }
      roundup_join: {
        Args: { p_code: string; p_user: string }
        Returns: {
          connected_count: number
          member_count: number
          status: string
        }[]
      }
      roundup_undo: {
        Args: { p_code: string; p_user: string }
        Returns: number
      }
      viewer_group_ids: {
        Args: { p_user: string }
        Returns: {
          group_id: string
        }[]
      }
      week_start_for: { Args: { target: string }; Returns: string }
      wave_group_for_viewer: {
        Args: { p_viewer: string }
        Returns: {
          member_count: number
          member_ids: string[]
          member_names: string[]
          time_bucket: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
