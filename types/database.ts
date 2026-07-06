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
      ai_generations: {
        Row: {
          brand_profile_id: string | null;
          created_at: string;
          id: string;
          metadata: Json;
          operation: string;
          post_id: string | null;
          prompt_summary: string | null;
          provider: Database["public"]["Enums"]["ai_provider"];
          tokens_used: number | null;
        };
        Insert: {
          brand_profile_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          operation: string;
          post_id?: string | null;
          prompt_summary?: string | null;
          provider: Database["public"]["Enums"]["ai_provider"];
          tokens_used?: number | null;
        };
        Update: {
          brand_profile_id?: string | null;
          created_at?: string;
          id?: string;
          metadata?: Json;
          operation?: string;
          post_id?: string | null;
          prompt_summary?: string | null;
          provider?: Database["public"]["Enums"]["ai_provider"];
          tokens_used?: number | null;
        };
        Relationships: [];
      };
      brand_assets: {
        Row: {
          asset_type: string;
          brand_profile_id: string;
          created_at: string;
          file_name: string;
          id: string;
          mime_type: string;
          storage_path: string;
        };
        Insert: {
          asset_type: string;
          brand_profile_id: string;
          created_at?: string;
          file_name: string;
          id?: string;
          mime_type: string;
          storage_path: string;
        };
        Update: {
          asset_type?: string;
          brand_profile_id?: string;
          created_at?: string;
          file_name?: string;
          id?: string;
          mime_type?: string;
          storage_path?: string;
        };
        Relationships: [];
      };
      brand_profiles: {
        Row: {
          address: string | null;
          avoid_words: string[];
          brand_name: string;
          brand_values: string[];
          brand_voice: string[];
          business_description: string;
          color_accent: string;
          color_primary: string;
          color_secondary: string;
          competitors: string[];
          created_at: string;
          deleted_at: string | null;
          email: string | null;
          id: string;
          industry: string;
          is_complete: boolean;
          is_default: boolean;
          keywords: string[];
          logo_storage_path: string | null;
          phone: string | null;
          preferred_ctas: string[];
          products_services: Json;
          target_audience: string;
          updated_at: string;
          user_id: string;
          website: string | null;
          writing_style: string[];
        };
        Insert: {
          address?: string | null;
          avoid_words?: string[];
          brand_name?: string;
          brand_values?: string[];
          brand_voice?: string[];
          business_description?: string;
          color_accent?: string;
          color_primary?: string;
          color_secondary?: string;
          competitors?: string[];
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          industry?: string;
          is_complete?: boolean;
          is_default?: boolean;
          keywords?: string[];
          logo_storage_path?: string | null;
          phone?: string | null;
          preferred_ctas?: string[];
          products_services?: Json;
          target_audience?: string;
          updated_at?: string;
          user_id: string;
          website?: string | null;
          writing_style?: string[];
        };
        Update: {
          address?: string | null;
          avoid_words?: string[];
          brand_name?: string;
          brand_values?: string[];
          brand_voice?: string[];
          business_description?: string;
          color_accent?: string;
          color_primary?: string;
          color_secondary?: string;
          competitors?: string[];
          created_at?: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          industry?: string;
          is_complete?: boolean;
          is_default?: boolean;
          keywords?: string[];
          logo_storage_path?: string | null;
          phone?: string | null;
          preferred_ctas?: string[];
          products_services?: Json;
          target_audience?: string;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
          writing_style?: string[];
        };
        Relationships: [];
      };
      marketing_campaigns: {
        Row: {
          campaign_goal: string;
          created_at: string;
          duration_days: number;
          extra_instructions: string | null;
          id: string;
          is_active: boolean;
          name: string;
          product_ids: string[];
          seasonality: string | null;
          strategy: Json;
          strategy_content_mode: string;
          target_audience: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          campaign_goal: string;
          created_at?: string;
          duration_days: number;
          extra_instructions?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          product_ids?: string[];
          seasonality?: string | null;
          strategy?: Json;
          strategy_content_mode?: string;
          target_audience?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          campaign_goal?: string;
          created_at?: string;
          duration_days?: number;
          extra_instructions?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          product_ids?: string[];
          seasonality?: string | null;
          strategy?: Json;
          strategy_content_mode?: string;
          target_audience?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      platform_connections: {
        Row: {
          access_token_encrypted: string | null;
          account_name: string | null;
          created_at: string;
          external_account_id: string | null;
          id: string;
          metadata: Json;
          platform_id: string;
          refresh_token_encrypted: string | null;
          scopes: string[];
          status: Database["public"]["Enums"]["connection_status"];
          token_expires_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_token_encrypted?: string | null;
          account_name?: string | null;
          created_at?: string;
          external_account_id?: string | null;
          id?: string;
          metadata?: Json;
          platform_id: string;
          refresh_token_encrypted?: string | null;
          scopes?: string[];
          status?: Database["public"]["Enums"]["connection_status"];
          token_expires_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_token_encrypted?: string | null;
          account_name?: string | null;
          created_at?: string;
          external_account_id?: string | null;
          id?: string;
          metadata?: Json;
          platform_id?: string;
          refresh_token_encrypted?: string | null;
          scopes?: string[];
          status?: Database["public"]["Enums"]["connection_status"];
          token_expires_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      platforms: {
        Row: {
          config_schema: Json;
          display_name: string;
          icon_key: string;
          id: string;
          is_enabled: boolean;
          sort_order: number;
        };
        Insert: {
          config_schema?: Json;
          display_name: string;
          icon_key: string;
          id: string;
          is_enabled?: boolean;
          sort_order?: number;
        };
        Update: {
          config_schema?: Json;
          display_name?: string;
          icon_key?: string;
          id?: string;
          is_enabled?: boolean;
          sort_order?: number;
        };
        Relationships: [];
      };
      post_media: {
        Row: {
          created_at: string;
          file_size: number | null;
          height: number | null;
          id: string;
          media_type: Database["public"]["Enums"]["post_media_type"];
          metadata: Json;
          mime_type: string;
          post_id: string;
          storage_path: string;
          width: number | null;
        };
        Insert: {
          created_at?: string;
          file_size?: number | null;
          height?: number | null;
          id?: string;
          media_type: Database["public"]["Enums"]["post_media_type"];
          metadata?: Json;
          mime_type: string;
          post_id: string;
          storage_path: string;
          width?: number | null;
        };
        Update: {
          created_at?: string;
          file_size?: number | null;
          height?: number | null;
          id?: string;
          media_type?: Database["public"]["Enums"]["post_media_type"];
          metadata?: Json;
          mime_type?: string;
          post_id?: string;
          storage_path?: string;
          width?: number | null;
        };
        Relationships: [];
      };
      post_platforms: {
        Row: {
          platform_id: string;
          post_id: string;
        };
        Insert: {
          platform_id: string;
          post_id: string;
        };
        Update: {
          platform_id?: string;
          post_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_platforms_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_platforms_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          brand_profile_id: string | null;
          content: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          media_type: Database["public"]["Enums"]["media_type"];
          scheduled_at: string | null;
          status: Database["public"]["Enums"]["post_status"];
          timezone: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          brand_profile_id?: string | null;
          content?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          media_type?: Database["public"]["Enums"]["media_type"];
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          timezone?: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          brand_profile_id?: string | null;
          content?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          media_type?: Database["public"]["Enums"]["media_type"];
          scheduled_at?: string | null;
          status?: Database["public"]["Enums"]["post_status"];
          timezone?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          user_id: string;
          type: "product" | "service";
          name: string;
          description: string | null;
          source_url: string | null;
          image_storage_path: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: "product" | "service";
          name: string;
          description?: string | null;
          source_url?: string | null;
          image_storage_path?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: "product" | "service";
          name?: string;
          description?: string | null;
          source_url?: string | null;
          image_storage_path?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          email: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          email?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      publication_logs: {
        Row: {
          created_at: string;
          error_message: string | null;
          external_post_id: string | null;
          id: string;
          platform_connection_id: string | null;
          platform_id: string;
          post_id: string;
          published_at: string | null;
          request_payload: Json | null;
          response_payload: Json | null;
          status: Database["public"]["Enums"]["publication_status"];
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          external_post_id?: string | null;
          id?: string;
          platform_connection_id?: string | null;
          platform_id: string;
          post_id: string;
          published_at?: string | null;
          request_payload?: Json | null;
          response_payload?: Json | null;
          status: Database["public"]["Enums"]["publication_status"];
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          external_post_id?: string | null;
          id?: string;
          platform_connection_id?: string | null;
          platform_id?: string;
          post_id?: string;
          published_at?: string | null;
          request_payload?: Json | null;
          response_payload?: Json | null;
          status?: Database["public"]["Enums"]["publication_status"];
        };
        Relationships: [
          {
            foreignKeyName: "publication_logs_platform_connection_id_fkey";
            columns: ["platform_connection_id"];
            isOneToOne: false;
            referencedRelation: "platform_connections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "publication_logs_platform_id_fkey";
            columns: ["platform_id"];
            isOneToOne: false;
            referencedRelation: "platforms";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "publication_logs_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      scheduled_jobs: {
        Row: {
          attempts: number;
          created_at: string;
          id: string;
          last_error: string | null;
          max_attempts: number;
          platform_id: string;
          post_id: string;
          run_at: string;
          status: Database["public"]["Enums"]["job_status"];
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          platform_id: string;
          post_id: string;
          run_at: string;
          status?: Database["public"]["Enums"]["job_status"];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          max_attempts?: number;
          platform_id?: string;
          post_id?: string;
          run_at?: string;
          status?: Database["public"]["Enums"]["job_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      settings: {
        Row: {
          created_at: string;
          date_format: string;
          default_image_prompt: string;
          default_platform_ids: string[];
          default_post_status: Database["public"]["Enums"]["post_status"];
          default_text_prompt: string;
          default_text_length_prompt: string;
          gemini_image_size: string;
          gemini_image_style: string;
          gemini_model: string;
          id: string;
          openai_max_tokens: number;
          openai_model: string;
          openai_temperature: number;
          text_ai_provider: Database["public"]["Enums"]["ai_provider"];
          timezone: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          date_format?: string;
          default_image_prompt?: string;
          default_platform_ids?: string[];
          default_post_status?: Database["public"]["Enums"]["post_status"];
          default_text_prompt?: string;
          default_text_length_prompt?: string;
          gemini_image_size?: string;
          gemini_image_style?: string;
          gemini_model?: string;
          id?: string;
          openai_max_tokens?: number;
          openai_model?: string;
          openai_temperature?: number;
          text_ai_provider?: Database["public"]["Enums"]["ai_provider"];
          timezone?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          date_format?: string;
          default_image_prompt?: string;
          default_platform_ids?: string[];
          default_post_status?: Database["public"]["Enums"]["post_status"];
          default_text_prompt?: string;
          default_text_length_prompt?: string;
          gemini_image_size?: string;
          gemini_image_style?: string;
          gemini_model?: string;
          id?: string;
          openai_max_tokens?: number;
          openai_model?: string;
          openai_temperature?: number;
          text_ai_provider?: Database["public"]["Enums"]["ai_provider"];
          timezone?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      workspace_settings: {
        Row: {
          id: number;
          owner_user_id: string | null;
        };
        Insert: {
          id?: number;
          owner_user_id?: string | null;
        };
        Update: {
          id?: number;
          owner_user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      bootstrap_workspace_owner: {
        Args: { p_claimant: string };
        Returns: string;
      };
      is_workspace_member: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      owns_workspace_row: {
        Args: { row_user_id: string };
        Returns: boolean;
      };
      pin_workspace_owner: {
        Args: { p_owner: string };
        Returns: string;
      };
      workspace_owner_id: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
    Enums: {
      ai_provider: "openai" | "gemini";
      connection_status: "connected" | "expired" | "error" | "disconnected";
      job_status: "pending" | "processing" | "completed" | "failed";
      media_type: "none" | "image" | "video";
      post_media_type: "uploaded_image" | "generated_image" | "uploaded_video";
      post_status:
        | "draft"
        | "scheduled"
        | "publishing"
        | "published"
        | "failed"
        | "cancelled";
      publication_status: "success" | "failed";
    };
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
