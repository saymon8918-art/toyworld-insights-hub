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
      inventory: {
        Row: {
          created_at: string
          product_id: number
          stock_on_hand: number
          store_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          product_id: number
          stock_on_hand: number
          store_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          product_id?: number
          stock_on_hand?: number
          store_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          product_category: string
          product_cost: number
          product_id: number
          product_name: string
          product_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          product_category: string
          product_cost: number
          product_id: number
          product_name: string
          product_price: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          product_category?: string
          product_cost?: number
          product_id?: number
          product_name?: string
          product_price?: number
          updated_at?: string
        }
        Relationships: []
      }
      sales: {
        Row: {
          created_at: string
          product_id: number
          sale_date: string
          sale_id: number
          store_id: number
          units: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          product_id: number
          sale_date: string
          sale_id: number
          store_id: number
          units: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          product_id?: number
          sale_date?: string
          sale_id?: number
          store_id?: number
          units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["store_id"]
          },
        ]
      }
      stores: {
        Row: {
          created_at: string
          store_city: string
          store_id: number
          store_location: string
          store_name: string
          store_open_date: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          store_city: string
          store_id: number
          store_location: string
          store_name: string
          store_open_date: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          store_city?: string
          store_id?: number
          store_location?: string
          store_name?: string
          store_open_date?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      analytics_assortment_gaps: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          category: string
          chain_daily_units: number
          est_revenue_week: number
          product_id: number
          product_name: string
          store_city: string
          store_id: number
          store_name: string
          stores_selling: number
        }[]
      }
      analytics_availability_summary: {
        Args: { p_days?: number; p_store_id?: number }
        Returns: {
          affected_stores: number
          at_risk: number
          availability_pct: number
          lost_profit_week: number
          lost_revenue_week: number
          lost_units_week: number
          out_of_stock: number
          tracked_pairs: number
        }[]
      }
      analytics_category_profit: {
        Args: { p_from?: string; p_store_id?: number; p_to?: string }
        Returns: {
          category: string
          cost: number
          margin_pct: number
          profit: number
          profit_share: number
          revenue: number
          sku_count: number
          units: number
        }[]
      }
      analytics_cover_buckets: {
        Args: { p_days?: number; p_store_id?: number }
        Returns: {
          bucket: string
          cost_value: number
          share_pct: number
          sku_rows: number
          sort_order: number
          units: number
        }[]
      }
      analytics_inventory_by_category: {
        Args: { p_days?: number; p_store_id?: number }
        Returns: {
          category: string
          cost_value: number
          daily_cost_burn: number
          days_cover: number
          retail_value: number
          share_pct: number
          units: number
        }[]
      }
      analytics_inventory_by_store: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          cost_value: number
          daily_cost_burn: number
          days_cover: number
          dead_cost_value: number
          store_city: string
          store_id: number
          store_location: string
          store_name: string
          units: number
        }[]
      }
      analytics_inventory_summary: {
        Args: { p_days?: number; p_store_id?: number }
        Returns: {
          cost_value: number
          daily_cost_burn: number
          days_cover: number
          dead_cost_value: number
          dead_rows: number
          locked_profit: number
          retail_value: number
          sku_rows: number
          units: number
        }[]
      }
      analytics_location_category_profit: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          category: string
          profit: number
          revenue: number
          share_pct: number
          store_count: number
          store_location: string
        }[]
      }
      analytics_lost_by_category: {
        Args: { p_days?: number }
        Returns: {
          category: string
          loss_ratio_pct: number
          lost_revenue_week: number
          lost_units_week: number
          out_of_stock: number
          revenue_week: number
        }[]
      }
      analytics_product_profit: {
        Args: {
          p_from?: string
          p_limit?: number
          p_store_id?: number
          p_to?: string
        }
        Returns: {
          category: string
          margin_pct: number
          product_id: number
          product_name: string
          profit: number
          revenue: number
          units: number
        }[]
      }
      analytics_profit_summary: {
        Args: { p_from?: string; p_store_id?: number; p_to?: string }
        Returns: {
          cost: number
          margin_pct: number
          profit: number
          revenue: number
          store_count: number
          units: number
        }[]
      }
      analytics_slow_movers: {
        Args: { p_days?: number; p_limit?: number; p_store_id?: number }
        Returns: {
          category: string
          cost_value: number
          daily_units: number
          days_cover: number
          product_id: number
          product_name: string
          stock_on_hand: number
          store_city: string
          store_id: number
          store_name: string
        }[]
      }
      analytics_stockout_items: {
        Args: { p_days?: number; p_limit?: number; p_store_id?: number }
        Returns: {
          category: string
          daily_units: number
          days_cover: number
          lost_revenue_week: number
          lost_units_week: number
          product_id: number
          product_name: string
          stock_on_hand: number
          store_city: string
          store_id: number
          store_name: string
        }[]
      }
      analytics_store_availability: {
        Args: { p_days?: number; p_limit?: number }
        Returns: {
          availability_pct: number
          loss_ratio_pct: number
          lost_revenue_week: number
          out_of_stock: number
          revenue_week: number
          store_city: string
          store_id: number
          store_location: string
          store_name: string
          tracked_pairs: number
        }[]
      }
      analytics_store_category_profit: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          category: string
          profit: number
          revenue: number
          share_pct: number
          store_city: string
          store_id: number
          store_location: string
          store_name: string
          store_profit: number
          units: number
        }[]
      }
      dashboard_category_sales: {
        Args: { p_from?: string; p_store_id?: number; p_to?: string }
        Returns: {
          category: string
          revenue: number
          units: number
        }[]
      }
      dashboard_date_bounds: {
        Args: never
        Returns: {
          max_date: string
          min_date: string
          sale_rows: number
        }[]
      }
      dashboard_kpis: {
        Args: { p_from?: string; p_store_id?: number; p_to?: string }
        Returns: {
          order_count: number
          prev_revenue: number
          prev_units: number
          revenue: number
          store_count: number
          top_category: string
          top_category_share: number
          units: number
        }[]
      }
      dashboard_low_stock: {
        Args: { p_limit?: number; p_store_id?: number; p_threshold?: number }
        Returns: {
          product_category: string
          product_id: number
          product_name: string
          stock_on_hand: number
          store_city: string
          store_id: number
          store_name: string
        }[]
      }
      dashboard_recent_sales: {
        Args: { p_limit?: number; p_search?: string; p_store_id?: number }
        Returns: {
          product_category: string
          product_name: string
          sale_date: string
          sale_id: number
          store_city: string
          store_name: string
          total: number
          units: number
        }[]
      }
      dashboard_sales_trend: {
        Args: {
          p_from?: string
          p_grain?: string
          p_store_id?: number
          p_to?: string
        }
        Returns: {
          bucket: string
          label: string
          sales: number
          units: number
        }[]
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
