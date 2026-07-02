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
      actions_flags: {
        Row: {
          client_visible: boolean
          id: string
          is_flag: boolean
          review_id: string
          severity: string | null
          text: string
        }
        Insert: {
          client_visible?: boolean
          id?: string
          is_flag?: boolean
          review_id: string
          severity?: string | null
          text: string
        }
        Update: {
          client_visible?: boolean
          id?: string
          is_flag?: boolean
          review_id?: string
          severity?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_flags_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "weekly_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          entity: string
          entity_id: string | null
          id: string
          meta: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          entity: string
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          meta?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_team: {
        Row: {
          client_id: string
          clinician_id: string
          consent_at: string | null
          relationship: string | null
        }
        Insert: {
          client_id: string
          clinician_id: string
          consent_at?: string | null
          relationship?: string | null
        }
        Update: {
          client_id?: string
          clinician_id?: string
          consent_at?: string | null
          relationship?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_team_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_team_clinician_id_fkey"
            columns: ["clinician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          baseline_week: number | null
          consultant_id: string | null
          created_at: string
          diagnosis: string
          id: string
          mrn: string
          profile_id: string
          programme_week: number | null
          rehab_lead_id: string | null
          status: string
          treatment_phase: string | null
        }
        Insert: {
          baseline_week?: number | null
          consultant_id?: string | null
          created_at?: string
          diagnosis: string
          id?: string
          mrn: string
          profile_id: string
          programme_week?: number | null
          rehab_lead_id?: string | null
          status?: string
          treatment_phase?: string | null
        }
        Update: {
          baseline_week?: number | null
          consultant_id?: string | null
          created_at?: string
          diagnosis?: string
          id?: string
          mrn?: string
          profile_id?: string
          programme_week?: number | null
          rehab_lead_id?: string | null
          status?: string
          treatment_phase?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_rehab_lead_id_fkey"
            columns: ["rehab_lead_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clinicians: {
        Row: {
          discipline: string
          profile_id: string
          registration_no: string | null
        }
        Insert: {
          discipline: string
          profile_id: string
          registration_no?: string | null
        }
        Update: {
          discipline?: string
          profile_id?: string
          registration_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinicians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      labs: {
        Row: {
          client_id: string
          created_at: string
          id: string
          panel: Json
          taken_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          panel: Json
          taken_at: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          panel?: Json
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "labs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      metric_readings: {
        Row: {
          current: number | null
          delta: number | null
          history: Json
          id: string
          metric_code: string
          previous: number | null
          review_id: string
          status: Database["public"]["Enums"]["metric_status"] | null
        }
        Insert: {
          current?: number | null
          delta?: number | null
          history?: Json
          id?: string
          metric_code: string
          previous?: number | null
          review_id: string
          status?: Database["public"]["Enums"]["metric_status"] | null
        }
        Update: {
          current?: number | null
          delta?: number | null
          history?: Json
          id?: string
          metric_code?: string
          previous?: number | null
          review_id?: string
          status?: Database["public"]["Enums"]["metric_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "metric_readings_metric_code_fkey"
            columns: ["metric_code"]
            isOneToOne: false
            referencedRelation: "metrics_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "metric_readings_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "weekly_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics_catalog: {
        Row: {
          client_label: string | null
          code: string
          direction_of_benefit: Database["public"]["Enums"]["direction_of_benefit"]
          is_estimate: boolean
          name: string
          pillar: Database["public"]["Enums"]["pillar"]
          target_def: Json
          unit: string | null
        }
        Insert: {
          client_label?: string | null
          code: string
          direction_of_benefit: Database["public"]["Enums"]["direction_of_benefit"]
          is_estimate?: boolean
          name: string
          pillar: Database["public"]["Enums"]["pillar"]
          target_def: Json
          unit?: string | null
        }
        Update: {
          client_label?: string | null
          code?: string
          direction_of_benefit?: Database["public"]["Enums"]["direction_of_benefit"]
          is_estimate?: boolean
          name?: string
          pillar?: Database["public"]["Enums"]["pillar"]
          target_def?: Json
          unit?: string | null
        }
        Relationships: []
      }
      pillar_scores: {
        Row: {
          baseline: number | null
          id: string
          pillar: Database["public"]["Enums"]["pillar"]
          review_id: string
          score: number
        }
        Insert: {
          baseline?: number | null
          id?: string
          pillar: Database["public"]["Enums"]["pillar"]
          review_id: string
          score: number
        }
        Update: {
          baseline?: number | null
          id?: string
          pillar?: Database["public"]["Enums"]["pillar"]
          review_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "pillar_scores_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "weekly_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["role"]
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["role"]
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          role?: Database["public"]["Enums"]["role"]
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          client_id: string
          composite_score: number | null
          context: Json
          created_at: string
          id: string
          issued_at: string | null
          issued_by: string | null
          signed_at: string | null
          signed_by: string | null
          status: Database["public"]["Enums"]["metric_status"] | null
          week_no: number
          window_end: string
          window_start: string
        }
        Insert: {
          client_id: string
          composite_score?: number | null
          context?: Json
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["metric_status"] | null
          week_no: number
          window_end: string
          window_start: string
        }
        Update: {
          client_id?: string
          composite_score?: number | null
          context?: Json
          created_at?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["metric_status"] | null
          week_no?: number
          window_end?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reviews_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reviews_signed_by_fkey"
            columns: ["signed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      client_home_payload: { Args: never; Returns: Json }
      current_client_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_clinical: { Args: never; Returns: boolean }
      is_on_care_team: { Args: { p_client: string }; Returns: boolean }
      jwt_role: { Args: never; Returns: string }
    }
    Enums: {
      direction_of_benefit: "higher" | "lower" | "range"
      metric_status: "on_track" | "watch" | "flag"
      pillar: "exercise" | "nutrition" | "immune"
      role: "consultant" | "nurse" | "cep" | "client" | "admin"
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
      direction_of_benefit: ["higher", "lower", "range"],
      metric_status: ["on_track", "watch", "flag"],
      pillar: ["exercise", "nutrition", "immune"],
      role: ["consultant", "nurse", "cep", "client", "admin"],
    },
  },
} as const
