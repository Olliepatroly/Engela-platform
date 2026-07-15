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
      account_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          path: string
          requested_role: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          path: string
          requested_role?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          path?: string
          requested_role?: string | null
          status?: string
        }
        Relationships: []
      }
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
      client_action_checks: {
        Row: {
          action_id: string
          checked_at: string
          client_id: string
        }
        Insert: {
          action_id: string
          checked_at?: string
          client_id: string
        }
        Update: {
          action_id?: string
          checked_at?: string
          client_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_action_checks_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "actions_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_action_checks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_health_profiles: {
        Row: {
          client_id: string
          details: Json
          parq: Json | null
          parq_completed_at: string | null
          parq_positive: boolean | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_id: string
          details?: Json
          parq?: Json | null
          parq_completed_at?: string | null
          parq_positive?: boolean | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_id?: string
          details?: Json
          parq?: Json | null
          parq_completed_at?: string | null
          parq_positive?: boolean | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_health_profiles_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_health_profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      client_metric_targets: {
        Row: {
          client_id: string
          metric_code: string
          set_at: string
          set_by: string | null
          target_def: Json
        }
        Insert: {
          client_id: string
          metric_code: string
          set_at?: string
          set_by?: string | null
          target_def: Json
        }
        Update: {
          client_id?: string
          metric_code?: string
          set_at?: string
          set_by?: string | null
          target_def?: Json
        }
        Relationships: [
          {
            foreignKeyName: "client_metric_targets_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_metric_targets_metric_code_fkey"
            columns: ["metric_code"]
            isOneToOne: false
            referencedRelation: "metrics_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "client_metric_targets_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          baseline_week: number | null
          body_map: string
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
          body_map?: string
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
          body_map?: string
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
      clinical_flags: {
        Row: {
          client_id: string
          created_at: string
          id: string
          raised_by: string
          raised_role: string
          reviewed_at: string | null
          reviewed_by: string | null
          sbar: Json | null
          session_id: string | null
          status: string
          summary: string | null
          tier: string
          transcript: string | null
          voice_path: string | null
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          raised_by: string
          raised_role: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sbar?: Json | null
          session_id?: string | null
          status?: string
          summary?: string | null
          tier: string
          transcript?: string | null
          voice_path?: string | null
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          raised_by?: string
          raised_role?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sbar?: Json | null
          session_id?: string | null
          status?: string
          summary?: string | null
          tier?: string
          transcript?: string | null
          voice_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_flags_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_flags_raised_by_fkey"
            columns: ["raised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_flags_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_flags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
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
      exercises: {
        Row: {
          category: Database["public"]["Enums"]["exercise_category"]
          created_at: string
          created_by: string | null
          equipment: string | null
          id: string
          instructions: string | null
          name: string
          primary_muscles: Database["public"]["Enums"]["muscle_group"][]
          secondary_muscles: Database["public"]["Enums"]["muscle_group"][]
        }
        Insert: {
          category: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          created_by?: string | null
          equipment?: string | null
          id?: string
          instructions?: string | null
          name: string
          primary_muscles?: Database["public"]["Enums"]["muscle_group"][]
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
        }
        Update: {
          category?: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          created_by?: string | null
          equipment?: string | null
          id?: string
          instructions?: string | null
          name?: string
          primary_muscles?: Database["public"]["Enums"]["muscle_group"][]
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          accepted_at: string | null
          accepted_profile: string | null
          created_at: string
          diagnosis: string | null
          email: string
          expires_at: string
          full_name: string
          id: string
          invited_by: string
          mrn: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_profile?: string | null
          created_at?: string
          diagnosis?: string | null
          email: string
          expires_at: string
          full_name: string
          id?: string
          invited_by: string
          mrn?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_profile?: string | null
          created_at?: string
          diagnosis?: string | null
          email?: string
          expires_at?: string
          full_name?: string
          id?: string
          invited_by?: string
          mrn?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invites_accepted_profile_fkey"
            columns: ["accepted_profile"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
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
      messages: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          recorded_at: string | null
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
          recorded_at?: string | null
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
          recorded_at?: string | null
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
          why_it_matters: string | null
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
          why_it_matters?: string | null
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
          why_it_matters?: string | null
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
      program_sessions: {
        Row: {
          client_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          program_id: string
          scheduled_for: string
          status: Database["public"]["Enums"]["session_status"]
          title: string
        }
        Insert: {
          client_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          program_id: string
          scheduled_for: string
          status?: Database["public"]["Enums"]["session_status"]
          title: string
        }
        Update: {
          client_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          program_id?: string
          scheduled_for?: string
          status?: Database["public"]["Enums"]["session_status"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_sessions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_sessions_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          focus: string | null
          id: string
          starts_on: string | null
          status: string
          title: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          focus?: string | null
          id?: string
          starts_on?: string | null
          status?: string
          title: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          focus?: string | null
          id?: string
          starts_on?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercises: {
        Row: {
          aimed_intensity: number | null
          completed_at: string | null
          distance_km: number | null
          duration_min: number | null
          effort_recorded_at: string | null
          exercise_id: string
          id: string
          notes: string | null
          perceived_effort: number | null
          position: number
          reps: number | null
          session_id: string
          sets: number | null
          weight_kg: number | null
        }
        Insert: {
          aimed_intensity?: number | null
          completed_at?: string | null
          distance_km?: number | null
          duration_min?: number | null
          effort_recorded_at?: string | null
          exercise_id: string
          id?: string
          notes?: string | null
          perceived_effort?: number | null
          position?: number
          reps?: number | null
          session_id: string
          sets?: number | null
          weight_kg?: number | null
        }
        Update: {
          aimed_intensity?: number | null
          completed_at?: string | null
          distance_km?: number | null
          duration_min?: number | null
          effort_recorded_at?: string | null
          exercise_id?: string
          id?: string
          notes?: string | null
          perceived_effort?: number | null
          position?: number
          reps?: number | null
          session_id?: string
          sets?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "program_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      team_requests: {
        Row: {
          client_id: string
          clinician_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["team_request_kind"]
          message: string | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["team_request_status"]
        }
        Insert: {
          client_id: string
          clinician_id: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["team_request_kind"]
          message?: string | null
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["team_request_status"]
        }
        Update: {
          client_id?: string
          clinician_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["team_request_kind"]
          message?: string | null
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["team_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "team_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_requests_clinician_id_fkey"
            columns: ["clinician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      my_care_team: { Args: never; Returns: Json }
      my_team_requests: { Args: never; Returns: Json }
      search_directory: {
        Args: { q: string }
        Returns: {
          discipline: string
          full_name: string
          id: string
          kind: string
          member_role: string
        }[]
      }
    }
    Enums: {
      direction_of_benefit: "higher" | "lower" | "range"
      exercise_category: "cardiovascular" | "resistance" | "mobility"
      metric_status: "on_track" | "watch" | "flag"
      muscle_group:
        | "traps"
        | "shoulders"
        | "chest"
        | "biceps"
        | "triceps"
        | "forearms"
        | "abdominals"
        | "obliques"
        | "upper_back"
        | "lats"
        | "lower_back"
        | "glutes"
        | "quadriceps"
        | "hamstrings"
        | "calves"
      pillar: "exercise" | "nutrition" | "immune"
      role: "consultant" | "nurse" | "cep" | "client" | "admin" | "physio"
      session_status: "scheduled" | "completed" | "missed"
      team_request_kind: "client_request" | "clinician_invite" | "peer_invite"
      team_request_status: "pending" | "accepted" | "declined" | "cancelled"
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
      exercise_category: ["cardiovascular", "resistance", "mobility"],
      metric_status: ["on_track", "watch", "flag"],
      muscle_group: [
        "traps",
        "shoulders",
        "chest",
        "biceps",
        "triceps",
        "forearms",
        "abdominals",
        "obliques",
        "upper_back",
        "lats",
        "lower_back",
        "glutes",
        "quadriceps",
        "hamstrings",
        "calves",
      ],
      pillar: ["exercise", "nutrition", "immune"],
      role: ["consultant", "nurse", "cep", "client", "admin", "physio"],
      session_status: ["scheduled", "completed", "missed"],
      team_request_kind: ["client_request", "clinician_invite", "peer_invite"],
      team_request_status: ["pending", "accepted", "declined", "cancelled"],
    },
  },
} as const
