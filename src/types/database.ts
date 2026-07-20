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
  public: {
    Tables: {
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
      groups: {
        Row: {
          created_at: string
          emoji: string
          id: string
          invite_code: string | null
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          invite_code?: string | null
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          invite_code?: string | null
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
      users: {
        Row: {
          area_zip: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          interests: string[] | null
          is_admin: boolean
          is_available: boolean
          last_active_at: string | null
          last_green_at: string | null
          onboarding_complete: boolean
          phone: string
          referral_code: string
          status_move_id: string | null
          status_note: string | null
          status_set_at: string | null
          status_time: string | null
          visible_to: string[] | null
        }
        Insert: {
          area_zip?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          interests?: string[] | null
          is_admin?: boolean
          is_available?: boolean
          last_active_at?: string | null
          last_green_at?: string | null
          onboarding_complete?: boolean
          phone: string
          referral_code?: string
          status_move_id?: string | null
          status_note?: string | null
          status_set_at?: string | null
          status_time?: string | null
          visible_to?: string[] | null
        }
        Update: {
          area_zip?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          interests?: string[] | null
          is_admin?: boolean
          is_available?: boolean
          last_active_at?: string | null
          last_green_at?: string | null
          onboarding_complete?: boolean
          phone?: string
          referral_code?: string
          status_move_id?: string | null
          status_note?: string | null
          status_set_at?: string | null
          status_time?: string | null
          visible_to?: string[] | null
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
      sponsors: {
        Row: {
          business_name: string | null
          created_at: string
          default_payment_method_id: string | null
          id: string
          phone: string
          stripe_customer_id: string | null
        }
        Insert: {
          business_name?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          id?: string
          phone: string
          stripe_customer_id?: string | null
        }
        Update: {
          business_name?: string | null
          created_at?: string
          default_payment_method_id?: string | null
          id?: string
          phone?: string
          stripe_customer_id?: string | null
        }
        Relationships: []
      }
      sponsored_moves: {
        Row: {
          area_zip: string
          brand: string | null
          brought_over_count: number
          category: string
          clicks: number
          created_at: string
          description: string
          id: string
          image_url: string | null
          impressions: number
          interested_count: number
          link_url: string | null
          paid_at: string | null
          price_cents: number | null
          radius_miles: number
          reject_reason: string | null
          sponsor_id: string | null
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
          description: string
          id?: string
          image_url?: string | null
          impressions?: number
          interested_count?: number
          link_url?: string | null
          paid_at?: string | null
          price_cents?: number | null
          radius_miles?: number
          reject_reason?: string | null
          sponsor_id?: string | null
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
          description?: string
          id?: string
          image_url?: string | null
          impressions?: number
          interested_count?: number
          link_url?: string | null
          paid_at?: string | null
          price_cents?: number | null
          radius_miles?: number
          reject_reason?: string | null
          sponsor_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          time_text?: string | null
          title?: string
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
          joiner_id: string
          mover_id: string
        }
        Insert: {
          created_at?: string
          joiner_id: string
          mover_id: string
        }
        Update: {
          created_at?: string
          joiner_id?: string
          mover_id?: string
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
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_referral_code: { Args: never; Returns: string }
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
  public: {
    Enums: {},
  },
} as const
