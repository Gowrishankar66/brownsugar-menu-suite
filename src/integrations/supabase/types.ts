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
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          available: boolean
          category_id: string | null
          created_at: string
          description: string | null
          gst_percentage: number
          id: string
          image_url: string | null
          name: string
          price: number
          sku: string | null
          sort_order: number
          veg_type: string
        }
        Insert: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          gst_percentage?: number
          id?: string
          image_url?: string | null
          name: string
          price?: number
          sku?: string | null
          sort_order?: number
          veg_type?: string
        }
        Update: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          gst_percentage?: number
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          sku?: string | null
          sort_order?: number
          veg_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      order_amendments: {
        Row: {
          action: string
          actor_role: string
          actor_user_id: string | null
          created_at: string
          details: Json
          id: string
          order_id: string
        }
        Insert: {
          action: string
          actor_role: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          order_id: string
        }
        Update: {
          action?: string
          actor_role?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_amendments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          gst_percentage: number
          id: string
          line_cgst: number
          line_gst: number
          line_sgst: number
          line_subtotal: number
          line_total: number
          menu_item_id: string | null
          name: string
          order_id: string
          quantity: number
          sku: string | null
          special_instructions: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          gst_percentage?: number
          id?: string
          line_cgst?: number
          line_gst: number
          line_sgst?: number
          line_subtotal: number
          line_total: number
          menu_item_id?: string | null
          name: string
          order_id: string
          quantity: number
          sku?: string | null
          special_instructions?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          gst_percentage?: number
          id?: string
          line_cgst?: number
          line_gst?: number
          line_sgst?: number
          line_subtotal?: number
          line_total?: number
          menu_item_id?: string | null
          name?: string
          order_id?: string
          quantity?: number
          sku?: string | null
          special_instructions?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          accepted_at: string | null
          cgst_amount: number
          completed_at: string | null
          created_at: string
          daily_seq: number
          gst_amount: number
          id: string
          notes: string | null
          order_date: string
          order_number: string
          sgst_amount: number
          status: string
          subtotal: number
          table_id: string | null
          table_number: number
          total: number
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          cgst_amount?: number
          completed_at?: string | null
          created_at?: string
          daily_seq: number
          gst_amount?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          sgst_amount?: number
          status?: string
          subtotal?: number
          table_id?: string | null
          table_number: number
          total?: number
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          cgst_amount?: number
          completed_at?: string | null
          created_at?: string
          daily_seq?: number
          gst_amount?: number
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          sgst_amount?: number
          status?: string
          subtotal?: number
          table_id?: string | null
          table_number?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          table_number: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          table_number: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          table_number?: number
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
