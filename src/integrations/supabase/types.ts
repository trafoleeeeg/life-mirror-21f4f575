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
          created_at: string
          id: string
          label: string
          last_seen_at: string
          mentions: number
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          last_seen_at?: string
          mentions?: number
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_seen_at?: string
          mentions?: number
          type?: string
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
      profiles: {
        Row: {
          ai_tone: string
          avatar_url: string | null
          created_at: string
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
          display_name?: string | null
          email_notifications?: boolean
          id?: string
          language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      compute_ping_streak: { Args: { _user: string }; Returns: number }
      try_unlock: { Args: { _code: string; _user: string }; Returns: undefined }
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
