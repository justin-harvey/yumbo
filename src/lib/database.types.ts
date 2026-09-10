// Database types for the Produce Risk Scanner schema.
//
// Hand-authored to mirror supabase/migrations/20260823000000_init_produce_risk.sql
// so the app type-checks without a local Supabase (no Docker here). This is
// shaped as a drop-in for `supabase gen types typescript` output — once the
// hosted project is linked, regenerate to confirm parity and pick up FK
// relationships:
//
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      commodities: {
        Row: {
          id: string;
          slug: string;
          display_name: string;
          category: string;
          heavy_metal_tier: number;
          pesticide_tier: number;
          organic_pesticide_mitigation: number;
          notes: string | null;
          sources: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          display_name: string;
          category: string;
          heavy_metal_tier: number;
          pesticide_tier: number;
          organic_pesticide_mitigation?: number;
          notes?: string | null;
          sources?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          display_name?: string;
          category?: string;
          heavy_metal_tier?: number;
          pesticide_tier?: number;
          organic_pesticide_mitigation?: number;
          notes?: string | null;
          sources?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      origins: {
        Row: {
          id: string;
          country_code: string;
          region: string | null;
          display_name: string;
          pesticide_multiplier: number;
          heavy_metal_multiplier: number;
          organic_fraud_risk: number;
          notes: string | null;
          sources: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          country_code: string;
          region?: string | null;
          display_name: string;
          pesticide_multiplier?: number;
          heavy_metal_multiplier?: number;
          organic_fraud_risk?: number;
          notes?: string | null;
          sources?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          country_code?: string;
          region?: string | null;
          display_name?: string;
          pesticide_multiplier?: number;
          heavy_metal_multiplier?: number;
          organic_fraud_risk?: number;
          notes?: string | null;
          sources?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      brands: {
        Row: {
          id: string;
          slug: string;
          display_name: string;
          parent_company: string | null;
          is_private_label: boolean;
          is_organic_line: boolean;
          gs1_prefixes: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          display_name: string;
          parent_company?: string | null;
          is_private_label?: boolean;
          is_organic_line?: boolean;
          gs1_prefixes?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          display_name?: string;
          parent_company?: string | null;
          is_private_label?: boolean;
          is_organic_line?: boolean;
          gs1_prefixes?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          gtin: string;
          display_name: string;
          brand_id: string | null;
          commodity_id: string;
          form: Database["public"]["Enums"]["product_form"];
          is_organic: boolean;
          organic_certifier: string | null;
          origin_id: string | null;
          origin_confidence: Database["public"]["Enums"]["evidence_strength"];
          net_weight_g: number | null;
          data_source: string | null;
          last_verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gtin: string;
          display_name: string;
          brand_id?: string | null;
          commodity_id: string;
          form: Database["public"]["Enums"]["product_form"];
          is_organic?: boolean;
          organic_certifier?: string | null;
          origin_id?: string | null;
          origin_confidence?: Database["public"]["Enums"]["evidence_strength"];
          net_weight_g?: number | null;
          data_source?: string | null;
          last_verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gtin?: string;
          display_name?: string;
          brand_id?: string | null;
          commodity_id?: string;
          form?: Database["public"]["Enums"]["product_form"];
          is_organic?: boolean;
          organic_certifier?: string | null;
          origin_id?: string | null;
          origin_confidence?: Database["public"]["Enums"]["evidence_strength"];
          net_weight_g?: number | null;
          data_source?: string | null;
          last_verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plu_codes: {
        Row: {
          code: string;
          commodity_id: string;
          display_name: string;
          is_organic: boolean;
          size_descriptor: string | null;
        };
        Insert: {
          code: string;
          commodity_id: string;
          display_name: string;
          size_descriptor?: string | null;
        };
        Update: {
          code?: string;
          commodity_id?: string;
          display_name?: string;
          size_descriptor?: string | null;
        };
        Relationships: [];
      };
      suppliers: {
        Row: {
          id: string;
          slug: string;
          display_name: string;
          hq_location: string | null;
          facility_locations: string[];
          handles_forms: Database["public"]["Enums"]["product_form"][];
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          display_name: string;
          hq_location?: string | null;
          facility_locations?: string[];
          handles_forms?: Database["public"]["Enums"]["product_form"][];
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          display_name?: string;
          hq_location?: string | null;
          facility_locations?: string[];
          handles_forms?: Database["public"]["Enums"]["product_form"][];
          created_at?: string;
        };
        Relationships: [];
      };
      supplier_brand_links: {
        Row: {
          supplier_id: string;
          brand_id: string;
          evidence: Database["public"]["Enums"]["evidence_strength"];
          evidence_url: string | null;
          evidence_note: string | null;
          observed_at: string | null;
          created_at: string;
        };
        Insert: {
          supplier_id: string;
          brand_id: string;
          evidence: Database["public"]["Enums"]["evidence_strength"];
          evidence_url?: string | null;
          evidence_note?: string | null;
          observed_at?: string | null;
          created_at?: string;
        };
        Update: {
          supplier_id?: string;
          brand_id?: string;
          evidence?: Database["public"]["Enums"]["evidence_strength"];
          evidence_url?: string | null;
          evidence_note?: string | null;
          observed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      contamination_findings: {
        Row: {
          id: string;
          kind: Database["public"]["Enums"]["finding_type"];
          analyte: string | null;
          commodity_id: string | null;
          origin_id: string | null;
          supplier_id: string | null;
          brand_id: string | null;
          product_id: string | null;
          reported_on: string;
          source_name: string;
          source_url: string | null;
          summary: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          kind: Database["public"]["Enums"]["finding_type"];
          analyte?: string | null;
          commodity_id?: string | null;
          origin_id?: string | null;
          supplier_id?: string | null;
          brand_id?: string | null;
          product_id?: string | null;
          reported_on: string;
          source_name: string;
          source_url?: string | null;
          summary: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          kind?: Database["public"]["Enums"]["finding_type"];
          analyte?: string | null;
          commodity_id?: string | null;
          origin_id?: string | null;
          supplier_id?: string | null;
          brand_id?: string | null;
          product_id?: string | null;
          reported_on?: string;
          source_name?: string;
          source_url?: string | null;
          summary?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      product_submissions: {
        Row: {
          id: string;
          gtin: string;
          display_name: string;
          commodity_id: string;
          brand_name: string | null;
          is_organic: boolean;
          origin_id: string | null;
          off_data: Json | null;
          status: Database["public"]["Enums"]["submission_status"];
          submitted_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          gtin: string;
          display_name: string;
          commodity_id: string;
          brand_name?: string | null;
          is_organic?: boolean;
          origin_id?: string | null;
          off_data?: Json | null;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_by?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          gtin?: string;
          display_name?: string;
          commodity_id?: string;
          brand_name?: string | null;
          is_organic?: boolean;
          origin_id?: string | null;
          off_data?: Json | null;
          status?: Database["public"]["Enums"]["submission_status"];
          submitted_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      product_risk: {
        Row: {
          product_id: string | null;
          gtin: string | null;
          display_name: string | null;
          brand_name: string | null;
          commodity_name: string | null;
          category: string | null;
          form: Database["public"]["Enums"]["product_form"] | null;
          is_organic: boolean | null;
          origin_name: string | null;
          origin_confidence:
            | Database["public"]["Enums"]["evidence_strength"]
            | null;
          pesticide_score: number | null;
          heavy_metal_score: number | null;
          origin_unknown: boolean | null;
        };
        Relationships: [];
      };
      plu_risk: {
        Row: {
          code: string | null;
          display_name: string | null;
          commodity_name: string | null;
          category: string | null;
          is_organic: boolean | null;
          pesticide_score: number | null;
          heavy_metal_score: number | null;
        };
        Relationships: [];
      };
      catalog_risk: {
        Row: {
          source: string | null;
          verified: boolean | null;
          submission_id: string | null;
          product_id: string | null;
          gtin: string | null;
          display_name: string | null;
          brand_name: string | null;
          commodity_name: string | null;
          category: string | null;
          form: string | null;
          is_organic: boolean | null;
          origin_name: string | null;
          origin_confidence: string | null;
          pesticide_score: number | null;
          heavy_metal_score: number | null;
          origin_unknown: boolean | null;
          created_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      pesticide_score: {
        Args: {
          base_tier: number;
          multiplier: number;
          is_organic: boolean;
          mitigation: number;
        };
        Returns: number;
      };
      heavy_metal_score: {
        Args: { base_tier: number; multiplier: number };
        Returns: number;
      };
    };
    Enums: {
      product_form: "fresh" | "frozen" | "canned" | "dried" | "juice";
      evidence_strength: "documented" | "inferred" | "disputed";
      finding_type:
        | "pesticide_residue"
        | "heavy_metal"
        | "pathogen"
        | "organic_fraud"
        | "import_refusal";
      submission_status: "pending" | "approved" | "rejected";
    };
    CompositeTypes: Record<never, never>;
  };
};

// Convenience row aliases used across the app.
export type Commodity = Database["public"]["Tables"]["commodities"]["Row"];
export type Origin = Database["public"]["Tables"]["origins"]["Row"];
export type PluCode = Database["public"]["Tables"]["plu_codes"]["Row"];
export type ProductRisk = Database["public"]["Views"]["product_risk"]["Row"];
export type CatalogRisk = Database["public"]["Views"]["catalog_risk"]["Row"];
export type PluRisk = Database["public"]["Views"]["plu_risk"]["Row"];
