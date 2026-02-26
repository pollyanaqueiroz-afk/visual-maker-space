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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      briefing_deliveries: {
        Row: {
          briefing_image_id: string
          comments: string | null
          created_at: string
          delivered_by_email: string
          file_url: string
          id: string
        }
        Insert: {
          briefing_image_id: string
          comments?: string | null
          created_at?: string
          delivered_by_email: string
          file_url: string
          id?: string
        }
        Update: {
          briefing_image_id?: string
          comments?: string | null
          created_at?: string
          delivered_by_email?: string
          file_url?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_deliveries_briefing_image_id_fkey"
            columns: ["briefing_image_id"]
            isOneToOne: false
            referencedRelation: "briefing_images"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_images: {
        Row: {
          assigned_email: string | null
          copy_style_from: string | null
          created_at: string
          deadline: string | null
          delivery_token: string | null
          element_suggestion: string | null
          font_suggestion: string | null
          id: string
          image_text: string | null
          image_type: Database["public"]["Enums"]["image_type"]
          observations: string | null
          orientation: string | null
          product_name: string | null
          professional_photo_url: string | null
          request_id: string
          sort_order: number
          status: Database["public"]["Enums"]["request_status"]
        }
        Insert: {
          assigned_email?: string | null
          copy_style_from?: string | null
          created_at?: string
          deadline?: string | null
          delivery_token?: string | null
          element_suggestion?: string | null
          font_suggestion?: string | null
          id?: string
          image_text?: string | null
          image_type: Database["public"]["Enums"]["image_type"]
          observations?: string | null
          orientation?: string | null
          product_name?: string | null
          professional_photo_url?: string | null
          request_id: string
          sort_order?: number
          status?: Database["public"]["Enums"]["request_status"]
        }
        Update: {
          assigned_email?: string | null
          copy_style_from?: string | null
          created_at?: string
          deadline?: string | null
          delivery_token?: string | null
          element_suggestion?: string | null
          font_suggestion?: string | null
          id?: string
          image_text?: string | null
          image_type?: Database["public"]["Enums"]["image_type"]
          observations?: string | null
          orientation?: string | null
          product_name?: string | null
          professional_photo_url?: string | null
          request_id?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "briefing_images_copy_style_from_fkey"
            columns: ["copy_style_from"]
            isOneToOne: false
            referencedRelation: "briefing_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "briefing_images_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "briefing_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_reference_images: {
        Row: {
          briefing_image_id: string
          created_at: string
          file_url: string
          id: string
          is_exact_use: boolean
        }
        Insert: {
          briefing_image_id: string
          created_at?: string
          file_url: string
          id?: string
          is_exact_use?: boolean
        }
        Update: {
          briefing_image_id?: string
          created_at?: string
          file_url?: string
          id?: string
          is_exact_use?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "briefing_reference_images_briefing_image_id_fkey"
            columns: ["briefing_image_id"]
            isOneToOne: false
            referencedRelation: "briefing_images"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_requests: {
        Row: {
          assigned_to: string | null
          brand_drive_link: string | null
          brand_file_url: string | null
          created_at: string
          has_challenge: boolean
          has_community: boolean
          has_trail: boolean
          id: string
          notes: string | null
          platform_url: string
          requester_email: string
          requester_name: string
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          brand_drive_link?: string | null
          brand_file_url?: string | null
          created_at?: string
          has_challenge?: boolean
          has_community?: boolean
          has_trail?: boolean
          id?: string
          notes?: string | null
          platform_url: string
          requester_email: string
          requester_name: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          brand_drive_link?: string | null
          brand_file_url?: string | null
          created_at?: string
          has_challenge?: boolean
          has_community?: boolean
          has_trail?: boolean
          id?: string
          notes?: string | null
          platform_url?: string
          requester_email?: string
          requester_name?: string
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
      image_type:
        | "login"
        | "banner_vitrine"
        | "product_cover"
        | "trail_banner"
        | "challenge_banner"
        | "community_banner"
      request_status:
        | "pending"
        | "in_progress"
        | "review"
        | "completed"
        | "cancelled"
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
      app_role: ["admin", "member"],
      image_type: [
        "login",
        "banner_vitrine",
        "product_cover",
        "trail_banner",
        "challenge_banner",
        "community_banner",
      ],
      request_status: [
        "pending",
        "in_progress",
        "review",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
