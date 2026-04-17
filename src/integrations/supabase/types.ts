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
      achievements: {
        Row: {
          category: string
          code: string
          created_at: string
          description: string
          emoji: string
          id: string
          threshold: number
          title: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          description: string
          emoji?: string
          id?: string
          threshold?: number
          title: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          description?: string
          emoji?: string
          id?: string
          threshold?: number
          title?: string
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          created_at: string
          energy: number | null
          id: string
          intent: string | null
          mode: string
          mood: number | null
          note: string | null
          sleep_hours: number | null
          tags: string[]
          user_id: string
        }
        Insert: {
          created_at?: string
          energy?: number | null
          id?: string
          intent?: string | null
          mode: string
          mood?: number | null
          note?: string | null
          sleep_hours?: number | null
          tags?: string[]
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number | null
          id?: string
          intent?: string | null
          mode?: string
          mood?: number | null
          note?: string | null
          sleep_hours?: number | null
          tags?: string[]
          user_id?: string
        }
        Relationships: []
      }
      glyph_stats: {
        Row: {
          body: number
          career: number
          creativity: number
          emotions: number
          finance: number
          id: string
          meaning: number
          mind: number
          recorded_at: string
          relationships: number
          user_id: string
        }
        Insert: {
          body?: number
          career?: number
          creativity?: number
          emotions?: number
          finance?: number
          id?: string
          meaning?: number
          mind?: number
          recorded_at?: string
          relationships?: number
          user_id: string
        }
        Update: {
          body?: number
          career?: number
          creativity?: number
          emotions?: number
          finance?: number
          id?: string
          meaning?: number
          mind?: number
          recorded_at?: string
          relationships?: number
          user_id?: string
        }
        Relationships: []
      }
      graph_edges: {
        Row: {
          a_id: string
          b_id: string
          created_at: string
          id: string
          last_seen_at: string
          strength: number
          user_id: string
        }
        Insert: {
          a_id: string
          b_id: string
          created_at?: string
          id?: string
          last_seen_at?: string
          strength?: number
          user_id: string
        }
        Update: {
          a_id?: string
          b_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string
          strength?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "graph_edges_a_id_fkey"
            columns: ["a_id"]
            isOneToOne: false
            referencedRelation: "graph_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graph_edges_b_id_fkey"
            columns: ["b_id"]
            isOneToOne: false
            referencedRelation: "graph_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_entities: {
        Row: {
          category: string | null
          created_at: string
          custom_label: string | null
          hidden: boolean
          id: string
          label: string
          last_seen_at: string
          mentions: number
          pinned: boolean
          type: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          custom_label?: string | null
          hidden?: boolean
          id?: string
          label: string
          last_seen_at?: string
          mentions?: number
          pinned?: boolean
          type: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          custom_label?: string | null
          hidden?: boolean
          id?: string
          label?: string
          last_seen_at?: string
          mentions?: number
          pinned?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      learn_progress: {
        Row: {
          id: string
          learned_at: string
          section_slug: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          learned_at?: string
          section_slug: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          learned_at?: string
          section_slug?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_forecasts: {
        Row: {
          actual: number | null
          actual_n: number | null
          baseline: number
          contributions: Json
          created_at: string
          day: string
          id: string
          morning_text: string | null
          predicted: number
          reconciled_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual?: number | null
          actual_n?: number | null
          baseline: number
          contributions?: Json
          created_at?: string
          day: string
          id?: string
          morning_text?: string | null
          predicted: number
          reconciled_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual?: number | null
          actual_n?: number | null
          baseline?: number
          contributions?: Json
          created_at?: string
          day?: string
          id?: string
          morning_text?: string | null
          predicted?: number
          reconciled_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mood_pings: {
        Row: {
          activities: string[]
          created_at: string
          emoji: string | null
          id: string
          mood: number
          note: string | null
          source: string
          user_id: string
        }
        Insert: {
          activities?: string[]
          created_at?: string
          emoji?: string | null
          id?: string
          mood: number
          note?: string | null
          source?: string
          user_id: string
        }
        Update: {
          activities?: string[]
          created_at?: string
          emoji?: string | null
          id?: string
          mood?: number
          note?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          end_hour: number
          id: string
          interval_minutes: number
          last_sent_at: string | null
          mood_emojis: string[]
          start_hour: number
          timezone: string
          track_activity: boolean
          track_mood: boolean
          updated_at: string
          user_id: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          end_hour?: number
          id?: string
          interval_minutes?: number
          last_sent_at?: string | null
          mood_emojis?: string[]
          start_hour?: number
          timezone?: string
          track_activity?: boolean
          track_mood?: boolean
          updated_at?: string
          user_id: string
          weekdays?: number[]
        }
        Update: {
          created_at?: string
          enabled?: boolean
          end_hour?: number
          id?: string
          interval_minutes?: number
          last_sent_at?: string | null
          mood_emojis?: string[]
          start_hour?: number
          timezone?: string
          track_activity?: boolean
          track_mood?: boolean
          updated_at?: string
          user_id?: string
          weekdays?: number[]
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          ai_author: string | null
          category: string
          content: string
          created_at: string
          id: string
          is_ai: boolean
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ai_author?: string | null
          category?: string
          content: string
          created_at?: string
          id?: string
          is_ai?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ai_author?: string | null
          category?: string
          content?: string
          created_at?: string
          id?: string
          is_ai?: boolean
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_tone: string
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          email_notifications: boolean
          id: string
          language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_tone?: string
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email_notifications?: boolean
          id?: string
          language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_tone?: string
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          email_notifications?: boolean
          id?: string
          language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          id: string
          payload_kind: string | null
          status_code: number | null
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          id?: string
          payload_kind?: string | null
          status_code?: number | null
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          id?: string
          payload_kind?: string | null
          status_code?: number | null
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quick_actions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          label: string
          position: number
          use_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: string
          label: string
          position?: number
          use_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          label?: string
          position?: number
          use_count?: number
          user_id?: string
        }
        Relationships: []
      }
      sleep_events: {
        Row: {
          event_type: string
          id: string
          magnitude: number
          session_id: string
          ts: string
          user_id: string
        }
        Insert: {
          event_type: string
          id?: string
          magnitude?: number
          session_id: string
          ts?: string
          user_id: string
        }
        Update: {
          event_type?: string
          id?: string
          magnitude?: number
          session_id?: string
          ts?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sleep_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sleep_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sleep_sessions: {
        Row: {
          avg_loudness: number | null
          created_at: string
          duration_minutes: number | null
          ended_at: string | null
          id: string
          interruptions: number
          notes: string | null
          quality: number | null
          smart_wake: boolean
          started_at: string
          updated_at: string
          user_id: string
          wake_window_end: string | null
          wake_window_start: string | null
          woken_at: string | null
        }
        Insert: {
          avg_loudness?: number | null
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          interruptions?: number
          notes?: string | null
          quality?: number | null
          smart_wake?: boolean
          started_at: string
          updated_at?: string
          user_id: string
          wake_window_end?: string | null
          wake_window_start?: string | null
          woken_at?: string | null
        }
        Update: {
          avg_loudness?: number | null
          created_at?: string
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          interruptions?: number
          notes?: string | null
          quality?: number | null
          smart_wake?: boolean
          started_at?: string
          updated_at?: string
          user_id?: string
          wake_window_end?: string | null
          wake_window_start?: string | null
          woken_at?: string | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dossier: {
        Row: {
          created_at: string
          goals: Json
          id: string
          last_auto_update_at: string | null
          notes: string | null
          patterns: Json
          relationships: Json
          resources: Json
          summary: string | null
          themes: Json
          triggers: Json
          updated_at: string
          user_id: string
          values_list: Json
          version: number
        }
        Insert: {
          created_at?: string
          goals?: Json
          id?: string
          last_auto_update_at?: string | null
          notes?: string | null
          patterns?: Json
          relationships?: Json
          resources?: Json
          summary?: string | null
          themes?: Json
          triggers?: Json
          updated_at?: string
          user_id: string
          values_list?: Json
          version?: number
        }
        Update: {
          created_at?: string
          goals?: Json
          id?: string
          last_auto_update_at?: string | null
          notes?: string | null
          patterns?: Json
          relationships?: Json
          resources?: Json
          summary?: string | null
          themes?: Json
          triggers?: Json
          updated_at?: string
          user_id?: string
          values_list?: Json
          version?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _internal_compute_ping_streak: {
        Args: { _user: string }
        Returns: number
      }
      _internal_unlock: {
        Args: { _code: string; _user: string }
        Returns: undefined
      }
      admin_list_users: {
        Args: never
        Returns: {
          achievements_count: number
          ai_tone: string
          avatar_url: string
          avg_mood: number
          checkins_count: number
          created_at: string
          deleted_at: string
          display_name: string
          email: string
          is_admin: boolean
          language: string
          last_activity: string
          last_sign_in_at: string
          pings_count: number
          sleep_count: number
          user_id: string
        }[]
      }
      admin_set_deleted: {
        Args: { _deleted: boolean; _user: string }
        Returns: undefined
      }
      admin_user_activity: {
        Args: { _days?: number; _user: string }
        Returns: {
          checkins: number
          day: string
          pings: number
          sleep_sessions: number
        }[]
      }
      compute_ping_streak: { Args: { _user: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merge_graph_entities: {
        Args: { _drop: string; _keep: string }
        Returns: undefined
      }
      try_unlock: { Args: { _code: string; _user: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
