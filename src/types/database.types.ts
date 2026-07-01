/**
 * Database types for the clinical platform.
 *
 * HAND-AUTHORED PLACEHOLDER matching supabase/migrations/0001_init.sql so that
 * application code is typed before the Supabase project exists. Once the project
 * is created and linked, REGENERATE this file from the live schema:
 *
 *     pnpm db:types
 *
 * Do not hand-edit after that — treat the generated file as the source of truth.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Role = "consultant" | "nurse" | "cep" | "client" | "admin";
export type Pillar = "exercise" | "nutrition" | "immune";
export type MetricStatus = "on_track" | "watch" | "flag";
export type DirectionOfBenefit = "higher" | "lower" | "range";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; role: Role; full_name: string; email: string; created_at: string };
        Insert: { id: string; role: Role; full_name: string; email: string; created_at?: string };
        Update: { id?: string; role?: Role; full_name?: string; email?: string; created_at?: string };
        Relationships: [];
      };
      clinicians: {
        Row: { profile_id: string; discipline: string; registration_no: string | null };
        Insert: { profile_id: string; discipline: string; registration_no?: string | null };
        Update: { profile_id?: string; discipline?: string; registration_no?: string | null };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          profile_id: string;
          mrn: string;
          diagnosis: string;
          treatment_phase: string | null;
          consultant_id: string | null;
          rehab_lead_id: string | null;
          programme_week: number | null;
          baseline_week: number | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          mrn: string;
          diagnosis: string;
          treatment_phase?: string | null;
          consultant_id?: string | null;
          rehab_lead_id?: string | null;
          programme_week?: number | null;
          baseline_week?: number | null;
          status?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      care_team: {
        Row: {
          client_id: string;
          clinician_id: string;
          relationship: string | null;
          consent_at: string | null;
        };
        Insert: {
          client_id: string;
          clinician_id: string;
          relationship?: string | null;
          consent_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["care_team"]["Insert"]>;
        Relationships: [];
      };
      weekly_reviews: {
        Row: {
          id: string;
          client_id: string;
          week_no: number;
          window_start: string;
          window_end: string;
          composite_score: number | null;
          status: MetricStatus | null;
          context: Json;
          issued_at: string | null;
          issued_by: string | null;
          signed_by: string | null;
          signed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          week_no: number;
          window_start: string;
          window_end: string;
          composite_score?: number | null;
          status?: MetricStatus | null;
          context?: Json;
          issued_at?: string | null;
          issued_by?: string | null;
          signed_by?: string | null;
          signed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_reviews"]["Insert"]>;
        Relationships: [];
      };
      pillar_scores: {
        Row: { id: string; review_id: string; pillar: Pillar; score: number; baseline: number | null };
        Insert: { id?: string; review_id: string; pillar: Pillar; score: number; baseline?: number | null };
        Update: Partial<Database["public"]["Tables"]["pillar_scores"]["Insert"]>;
        Relationships: [];
      };
      metrics_catalog: {
        Row: {
          code: string;
          pillar: Pillar;
          name: string;
          client_label: string | null;
          unit: string | null;
          target_def: Json;
          direction_of_benefit: DirectionOfBenefit;
          is_estimate: boolean;
        };
        Insert: {
          code: string;
          pillar: Pillar;
          name: string;
          client_label?: string | null;
          unit?: string | null;
          target_def: Json;
          direction_of_benefit: DirectionOfBenefit;
          is_estimate?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["metrics_catalog"]["Insert"]>;
        Relationships: [];
      };
      metric_readings: {
        Row: {
          id: string;
          review_id: string;
          metric_code: string;
          current: number | null;
          previous: number | null;
          delta: number | null;
          status: MetricStatus | null;
          history: Json;
        };
        Insert: {
          id?: string;
          review_id: string;
          metric_code: string;
          current?: number | null;
          previous?: number | null;
          delta?: number | null;
          status?: MetricStatus | null;
          history?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["metric_readings"]["Insert"]>;
        Relationships: [];
      };
      labs: {
        Row: { id: string; client_id: string; taken_at: string; panel: Json; created_at: string };
        Insert: { id?: string; client_id: string; taken_at: string; panel: Json; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["labs"]["Insert"]>;
        Relationships: [];
      };
      actions_flags: {
        Row: {
          id: string;
          review_id: string;
          text: string;
          is_flag: boolean;
          severity: string | null;
          client_visible: boolean;
        };
        Insert: {
          id?: string;
          review_id: string;
          text: string;
          is_flag?: boolean;
          severity?: string | null;
          client_visible?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["actions_flags"]["Insert"]>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          meta: Json;
          at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          meta?: Json;
          at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      role: Role;
      pillar: Pillar;
      metric_status: MetricStatus;
      direction_of_benefit: DirectionOfBenefit;
    };
    CompositeTypes: Record<never, never>;
  };
};
