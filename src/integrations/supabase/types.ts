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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      cargas: {
        Row: {
          amostras: number
          bonificacoes: number
          brindes: number
          id: string
          notas_fracionadas: number
          notas_sem_volume: number
          numero_carga: string
          outras: number
          peso_bruto_total_kg: number | null
          peso_liquido_total_kg: number | null
          processada_em: string
          processada_por: string | null
          processada_por_email: string
          total_notas: number
          trocas: number
          vendas: number
        }
        Insert: {
          amostras?: number
          bonificacoes?: number
          brindes?: number
          id?: string
          notas_fracionadas?: number
          notas_sem_volume?: number
          numero_carga: string
          outras?: number
          peso_bruto_total_kg?: number | null
          peso_liquido_total_kg?: number | null
          processada_em?: string
          processada_por?: string | null
          processada_por_email?: string
          total_notas?: number
          trocas?: number
          vendas?: number
        }
        Update: {
          amostras?: number
          bonificacoes?: number
          brindes?: number
          id?: string
          notas_fracionadas?: number
          notas_sem_volume?: number
          numero_carga?: string
          outras?: number
          peso_bruto_total_kg?: number | null
          peso_liquido_total_kg?: number | null
          processada_em?: string
          processada_por?: string | null
          processada_por_email?: string
          total_notas?: number
          trocas?: number
          vendas?: number
        }
        Relationships: [
          {
            foreignKeyName: "cargas_processada_por_fkey"
            columns: ["processada_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          carga_id: string
          chave_acesso: string
          cidade_uf: string
          destinatario: string
          especie_volume: string
          fracionado: boolean
          id: string
          natureza_operacao: string
          nf: string
          numero_troca: string | null
          pedido: string
          peso_bruto_kg: number | null
          peso_liquido_kg: number | null
          qtde_cx: number
          qtde_fd: number
          qtde_un: number
          tipo: string
          valor_nf: number
          volumes: number | null
        }
        Insert: {
          carga_id: string
          chave_acesso?: string
          cidade_uf?: string
          destinatario?: string
          especie_volume?: string
          fracionado?: boolean
          id?: string
          natureza_operacao?: string
          nf?: string
          numero_troca?: string | null
          pedido?: string
          peso_bruto_kg?: number | null
          peso_liquido_kg?: number | null
          qtde_cx?: number
          qtde_fd?: number
          qtde_un?: number
          tipo?: string
          valor_nf?: number
          volumes?: number | null
        }
        Update: {
          carga_id?: string
          chave_acesso?: string
          cidade_uf?: string
          destinatario?: string
          especie_volume?: string
          fracionado?: boolean
          id?: string
          natureza_operacao?: string
          nf?: string
          numero_troca?: string | null
          pedido?: string
          peso_bruto_kg?: number | null
          peso_liquido_kg?: number | null
          qtde_cx?: number
          qtde_fd?: number
          qtde_un?: number
          tipo?: string
          valor_nf?: number
          volumes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_carga_id_fkey"
            columns: ["carga_id"]
            isOneToOne: false
            referencedRelation: "cargas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
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
      buscar_cargas: {
        Args: { _termo: string }
        Returns: {
          amostras: number
          bonificacoes: number
          brindes: number
          id: string
          notas_fracionadas: number
          notas_sem_volume: number
          numero_carga: string
          outras: number
          peso_bruto_total_kg: number | null
          peso_liquido_total_kg: number | null
          processada_em: string
          processada_por: string | null
          processada_por_email: string
          total_notas: number
          trocas: number
          vendas: number
        }[]
        SetofOptions: {
          from: "*"
          to: "cargas"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dashboard_cargas: { Args: { _ate: string; _de: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_member: { Args: { _user_id: string }; Returns: boolean }
      reivindicar_admin: { Args: { _user_id: string }; Returns: boolean }
      salvar_carga: {
        Args: { _carga: Json; _notas: Json; _substituir: boolean }
        Returns: string
      }
      sistema_configurado: { Args: never; Returns: boolean }
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
