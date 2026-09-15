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
      bills: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          credit_card_id: string | null
          description: string
          due_date: string
          id: string
          is_paid: boolean
          notes: string | null
          paid_credit_card_id: string | null
          paid_method: string | null
          paid_on: string | null
          recurrence: string
          transaction_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          credit_card_id?: string | null
          description: string
          due_date: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_credit_card_id?: string | null
          paid_method?: string | null
          paid_on?: string | null
          recurrence?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          credit_card_id?: string | null
          description?: string
          due_date?: string
          id?: string
          is_paid?: boolean
          notes?: string | null
          paid_credit_card_id?: string | null
          paid_method?: string | null
          paid_on?: string | null
          recurrence?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      card_invoice_payments: {
        Row: {
          amount: number
          created_at: string
          credit_card_id: string
          id: string
          paid_method: string
          paid_on: string
          reference_month: string
          transaction_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          credit_card_id: string
          id?: string
          paid_method?: string
          paid_on?: string
          reference_month: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          credit_card_id?: string
          id?: string
          paid_method?: string
          paid_on?: string
          reference_month?: string
          transaction_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      credit_cards: {
        Row: {
          closing_day: number | null
          color: string | null
          created_at: string
          due_day: number | null
          id: string
          is_benefit: boolean
          limit_amount: number
          name: string
          user_id: string | null
        }
        Insert: {
          closing_day?: number | null
          color?: string | null
          created_at?: string
          due_day?: number | null
          id?: string
          is_benefit?: boolean
          limit_amount?: number
          name: string
          user_id?: string | null
        }
        Update: {
          closing_day?: number | null
          color?: string | null
          created_at?: string
          due_day?: number | null
          id?: string
          is_benefit?: boolean
          limit_amount?: number
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      investments: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          kind: string
          occurred_on: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          kind: string
          occurred_on?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          kind?: string
          occurred_on?: string
          user_id?: string | null
        }
        Relationships: []
      }
      list_items: {
        Row: {
          completed: boolean
          content: string
          created_at: string
          id: string
          list_id: string
          price: number | null
          user_id: string | null
        }
        Insert: {
          completed?: boolean
          content: string
          created_at?: string
          id?: string
          list_id: string
          price?: number | null
          user_id?: string | null
        }
        Update: {
          completed?: boolean
          content?: string
          created_at?: string
          id?: string
          list_id?: string
          price?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          id: string
          is_fixed: boolean
          name: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_fixed?: boolean
          name: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_fixed?: boolean
          name?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          category: string | null
          created_at: string
          credit_card_id: string
          description: string
          id: string
          installments_paid: number
          installments_total: number
          started_on: string
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          credit_card_id: string
          description: string
          id?: string
          installments_paid?: number
          installments_total?: number
          started_on?: string
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          credit_card_id?: string
          description?: string
          id?: string
          installments_paid?: number
          installments_total?: number
          started_on?: string
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      routine_blocks: {
        Row: {
          completed: boolean
          created_at: string
          day_of_week: number
          id: string
          time_label: string
          title: string
          user_id: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          day_of_week: number
          id?: string
          time_label?: string
          title: string
          user_id?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          day_of_week?: number
          id?: string
          time_label?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          is_priority: boolean
          scheduled_date: string
          title: string
          user_id: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          is_priority?: boolean
          scheduled_date?: string
          title: string
          user_id?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          is_priority?: boolean
          scheduled_date?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          credit_card_id: string | null
          description: string
          id: string
          occurred_on: string
          type: string
          user_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          credit_card_id?: string | null
          description: string
          id?: string
          occurred_on?: string
          type: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          credit_card_id?: string | null
          description?: string
          id?: string
          occurred_on?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_budgets: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          updated_at: string
          user_id: string | null
          week_start: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
          week_start: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
          user_id?: string | null
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
