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
      app_ajustes: {
        Row: {
          client_url: string
          created_at: string
          created_by: string | null
          icone_url: string | null
          id: string
          nova_descricao: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          client_url: string
          created_at?: string
          created_by?: string | null
          icone_url?: string | null
          id?: string
          nova_descricao?: string | null
          status?: string
          tipo: string
          updated_at?: string
        }
        Update: {
          client_url?: string
          created_at?: string
          created_by?: string | null
          icone_url?: string | null
          id?: string
          nova_descricao?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_assets: {
        Row: {
          altura: number | null
          aprovado_em: string | null
          cliente_id: string | null
          comentario_cliente: string | null
          created_at: string | null
          dimensoes_ok: boolean | null
          enviado_por: string | null
          id: string
          largura: number | null
          nome_arquivo: string | null
          status: string | null
          tamanho_bytes: number | null
          tipo: string
          url: string | null
        }
        Insert: {
          altura?: number | null
          aprovado_em?: string | null
          cliente_id?: string | null
          comentario_cliente?: string | null
          created_at?: string | null
          dimensoes_ok?: boolean | null
          enviado_por?: string | null
          id?: string
          largura?: number | null
          nome_arquivo?: string | null
          status?: string | null
          tamanho_bytes?: number | null
          tipo: string
          url?: string | null
        }
        Update: {
          altura?: number | null
          aprovado_em?: string | null
          cliente_id?: string | null
          comentario_cliente?: string | null
          created_at?: string | null
          dimensoes_ok?: boolean | null
          enviado_por?: string | null
          id?: string
          largura?: number | null
          nome_arquivo?: string | null
          status?: string | null
          tamanho_bytes?: number | null
          tipo?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_assets_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "app_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_checklist_historico: {
        Row: {
          checklist_item_id: string
          created_at: string
          dados_anteriores: string | null
          dados_novos: string | null
          editado_por: string
          id: string
        }
        Insert: {
          checklist_item_id: string
          created_at?: string
          dados_anteriores?: string | null
          dados_novos?: string | null
          editado_por?: string
          id?: string
        }
        Update: {
          checklist_item_id?: string
          created_at?: string
          dados_anteriores?: string | null
          dados_novos?: string | null
          editado_por?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_checklist_historico_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "app_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      app_checklist_items: {
        Row: {
          aprovado_em: string | null
          aprovado_pelo_cliente: boolean | null
          ator: string
          cliente_id: string | null
          comentario_cliente: string | null
          created_at: string | null
          dados_preenchidos: string | null
          descricao: string | null
          fase_numero: number
          feito: boolean | null
          feito_em: string | null
          feito_por: string | null
          id: string
          obrigatorio: boolean | null
          ordem: number | null
          plataforma: string
          responsavel: string | null
          sla_horas: number | null
          sla_vencimento: string | null
          texto: string
          tipo: string | null
          updated_at: string | null
          upload_dimensoes_ok: boolean | null
          upload_motivo_rejeicao: string | null
          upload_url: string | null
          upload_validado: boolean | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_pelo_cliente?: boolean | null
          ator: string
          cliente_id?: string | null
          comentario_cliente?: string | null
          created_at?: string | null
          dados_preenchidos?: string | null
          descricao?: string | null
          fase_numero: number
          feito?: boolean | null
          feito_em?: string | null
          feito_por?: string | null
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          plataforma?: string
          responsavel?: string | null
          sla_horas?: number | null
          sla_vencimento?: string | null
          texto: string
          tipo?: string | null
          updated_at?: string | null
          upload_dimensoes_ok?: boolean | null
          upload_motivo_rejeicao?: string | null
          upload_url?: string | null
          upload_validado?: boolean | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_pelo_cliente?: boolean | null
          ator?: string
          cliente_id?: string | null
          comentario_cliente?: string | null
          created_at?: string | null
          dados_preenchidos?: string | null
          descricao?: string | null
          fase_numero?: number
          feito?: boolean | null
          feito_em?: string | null
          feito_por?: string | null
          id?: string
          obrigatorio?: boolean | null
          ordem?: number | null
          plataforma?: string
          responsavel?: string | null
          sla_horas?: number | null
          sla_vencimento?: string | null
          texto?: string
          tipo?: string | null
          updated_at?: string | null
          upload_dimensoes_ok?: boolean | null
          upload_motivo_rejeicao?: string | null
          upload_url?: string | null
          upload_validado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "app_checklist_items_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "app_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_clientes: {
        Row: {
          cancelado_em: string | null
          cancelado_por: string | null
          data_criacao: string | null
          email: string
          empresa: string
          fase_atual: number | null
          hubspot_deal_id: string | null
          id: string
          motivo_cancelamento: string | null
          nome: string
          plataforma: string
          porcentagem_geral: number | null
          portal_primeiro_acesso: string | null
          portal_token: string | null
          prazo_estimado: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string | null
          telefone: string | null
          ultima_acao_cliente: string | null
          updated_at: string | null
          url_loja_apple: string | null
          url_loja_google: string | null
          whatsapp: string | null
        }
        Insert: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          data_criacao?: string | null
          email: string
          empresa: string
          fase_atual?: number | null
          hubspot_deal_id?: string | null
          id?: string
          motivo_cancelamento?: string | null
          nome: string
          plataforma?: string
          porcentagem_geral?: number | null
          portal_primeiro_acesso?: string | null
          portal_token?: string | null
          prazo_estimado?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string | null
          telefone?: string | null
          ultima_acao_cliente?: string | null
          updated_at?: string | null
          url_loja_apple?: string | null
          url_loja_google?: string | null
          whatsapp?: string | null
        }
        Update: {
          cancelado_em?: string | null
          cancelado_por?: string | null
          data_criacao?: string | null
          email?: string
          empresa?: string
          fase_atual?: number | null
          hubspot_deal_id?: string | null
          id?: string
          motivo_cancelamento?: string | null
          nome?: string
          plataforma?: string
          porcentagem_geral?: number | null
          portal_primeiro_acesso?: string | null
          portal_token?: string | null
          prazo_estimado?: string | null
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string | null
          telefone?: string | null
          ultima_acao_cliente?: string | null
          updated_at?: string | null
          url_loja_apple?: string | null
          url_loja_google?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      app_conversas: {
        Row: {
          autor: string
          cliente_id: string | null
          created_at: string | null
          fase_numero: number | null
          id: string
          mensagem: string
          tipo: string | null
        }
        Insert: {
          autor: string
          cliente_id?: string | null
          created_at?: string | null
          fase_numero?: number | null
          id?: string
          mensagem: string
          tipo?: string | null
        }
        Update: {
          autor?: string
          cliente_id?: string | null
          created_at?: string | null
          fase_numero?: number | null
          id?: string
          mensagem?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_conversas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "app_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_fases: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          data_conclusao: string | null
          data_inicio: string | null
          data_previsao: string | null
          duracao_dias_estimada: number | null
          id: string
          nome: string
          numero: number
          plataforma: string | null
          porcentagem: number | null
          sla_horas: number | null
          sla_vencimento: string | null
          sla_violado: boolean | null
          status: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          duracao_dias_estimada?: number | null
          id?: string
          nome: string
          numero: number
          plataforma?: string | null
          porcentagem?: number | null
          sla_horas?: number | null
          sla_vencimento?: string | null
          sla_violado?: boolean | null
          status?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inicio?: string | null
          data_previsao?: string | null
          duracao_dias_estimada?: number | null
          id?: string
          nome?: string
          numero?: number
          plataforma?: string | null
          porcentagem?: number | null
          sla_horas?: number | null
          sla_vencimento?: string | null
          sla_violado?: boolean | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_fases_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "app_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_formulario: {
        Row: {
          categoria: string | null
          cliente_id: string | null
          created_at: string | null
          descricao_curta: string | null
          descricao_longa: string | null
          enviado_em: string | null
          id: string
          nome_app: string | null
          palavras_chave: string | null
          preenchido_completo: boolean | null
          url_privacidade: string | null
          url_termos: string | null
        }
        Insert: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string | null
          descricao_curta?: string | null
          descricao_longa?: string | null
          enviado_em?: string | null
          id?: string
          nome_app?: string | null
          palavras_chave?: string | null
          preenchido_completo?: boolean | null
          url_privacidade?: string | null
          url_termos?: string | null
        }
        Update: {
          categoria?: string | null
          cliente_id?: string | null
          created_at?: string | null
          descricao_curta?: string | null
          descricao_longa?: string | null
          enviado_em?: string | null
          id?: string
          nome_app?: string | null
          palavras_chave?: string | null
          preenchido_completo?: boolean | null
          url_privacidade?: string | null
          url_termos?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_formulario_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "app_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notificacoes: {
        Row: {
          agendado_para: string | null
          canal: string
          cliente_id: string | null
          created_at: string | null
          destinatario: string | null
          enviado: boolean | null
          enviado_em: string | null
          erro: string | null
          id: string
          lida: boolean | null
          mensagem: string
          tipo: string
          titulo: string
        }
        Insert: {
          agendado_para?: string | null
          canal: string
          cliente_id?: string | null
          created_at?: string | null
          destinatario?: string | null
          enviado?: boolean | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          lida?: boolean | null
          mensagem: string
          tipo: string
          titulo: string
        }
        Update: {
          agendado_para?: string | null
          canal?: string
          cliente_id?: string | null
          created_at?: string | null
          destinatario?: string | null
          enviado?: boolean | null
          enviado_em?: string | null
          erro?: string | null
          id?: string
          lida?: boolean | null
          mensagem?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_notificacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "app_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      app_prerequisitos: {
        Row: {
          apple_id_corporativo: string | null
          cliente_id: string | null
          cnpj_bloqueado: boolean | null
          cnpj_tipo: string | null
          doc_cnpj_enviado: boolean | null
          doc_identidade_enviado: boolean | null
          duns_numero: string | null
          duns_solicitado: boolean | null
          email_corporativo: string | null
          id: string
          inscricao_como_empresa: boolean | null
          site_publicado: boolean | null
          site_url: string | null
          site_verificado_search_console: boolean | null
          taxa_apple_paga: boolean | null
          telefone_verificado: boolean | null
          tudo_ok: boolean | null
          updated_at: string | null
        }
        Insert: {
          apple_id_corporativo?: string | null
          cliente_id?: string | null
          cnpj_bloqueado?: boolean | null
          cnpj_tipo?: string | null
          doc_cnpj_enviado?: boolean | null
          doc_identidade_enviado?: boolean | null
          duns_numero?: string | null
          duns_solicitado?: boolean | null
          email_corporativo?: string | null
          id?: string
          inscricao_como_empresa?: boolean | null
          site_publicado?: boolean | null
          site_url?: string | null
          site_verificado_search_console?: boolean | null
          taxa_apple_paga?: boolean | null
          telefone_verificado?: boolean | null
          tudo_ok?: boolean | null
          updated_at?: string | null
        }
        Update: {
          apple_id_corporativo?: string | null
          cliente_id?: string | null
          cnpj_bloqueado?: boolean | null
          cnpj_tipo?: string | null
          doc_cnpj_enviado?: boolean | null
          doc_identidade_enviado?: boolean | null
          duns_numero?: string | null
          duns_solicitado?: boolean | null
          email_corporativo?: string | null
          id?: string
          inscricao_como_empresa?: boolean | null
          site_publicado?: boolean | null
          site_url?: string | null
          site_verificado_search_console?: boolean | null
          taxa_apple_paga?: boolean | null
          telefone_verificado?: boolean | null
          tudo_ok?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_prerequisitos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: true
            referencedRelation: "app_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          briefing_image_id: string | null
          created_at: string
          file_name: string | null
          file_url: string
          id: string
          platform_url: string
          source: string | null
          uploaded_by: string | null
        }
        Insert: {
          briefing_image_id?: string | null
          created_at?: string
          file_name?: string | null
          file_url: string
          id?: string
          platform_url: string
          source?: string | null
          uploaded_by?: string | null
        }
        Update: {
          briefing_image_id?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string
          id?: string
          platform_url?: string
          source?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_briefing_image_id_fkey"
            columns: ["briefing_image_id"]
            isOneToOne: false
            referencedRelation: "briefing_images"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_adjustment_items: {
        Row: {
          adjustment_id: string
          created_at: string
          file_name: string | null
          file_url: string
          id: string
          observations: string | null
        }
        Insert: {
          adjustment_id: string
          created_at?: string
          file_name?: string | null
          file_url: string
          id?: string
          observations?: string | null
        }
        Update: {
          adjustment_id?: string
          created_at?: string
          file_name?: string | null
          file_url?: string
          id?: string
          observations?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefing_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "briefing_adjustments"
            referencedColumns: ["id"]
          },
        ]
      }
      briefing_adjustments: {
        Row: {
          assigned_email: string | null
          client_email: string
          client_url: string
          created_at: string
          created_by: string | null
          deadline: string | null
          delivered_at: string | null
          delivered_by: string | null
          delivery_comments: string | null
          delivery_url: string | null
          id: string
          source_briefing_image_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_email?: string | null
          client_email: string
          client_url: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_comments?: string | null
          delivery_url?: string | null
          id?: string
          source_briefing_image_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_email?: string | null
          client_email?: string
          client_url?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          delivered_at?: string | null
          delivered_by?: string | null
          delivery_comments?: string | null
          delivery_url?: string | null
          id?: string
          source_briefing_image_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefing_adjustments_source_briefing_image_id_fkey"
            columns: ["source_briefing_image_id"]
            isOneToOne: false
            referencedRelation: "briefing_images"
            referencedColumns: ["id"]
          },
        ]
      }
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
          extra_info: string | null
          font_suggestion: string | null
          id: string
          image_text: string | null
          image_type: Database["public"]["Enums"]["image_type"]
          observations: string | null
          orientation: string | null
          price_per_art: number | null
          product_name: string | null
          professional_photo_url: string | null
          request_id: string
          revision_count: number
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
          extra_info?: string | null
          font_suggestion?: string | null
          id?: string
          image_text?: string | null
          image_type: Database["public"]["Enums"]["image_type"]
          observations?: string | null
          orientation?: string | null
          price_per_art?: number | null
          product_name?: string | null
          professional_photo_url?: string | null
          request_id: string
          revision_count?: number
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
          extra_info?: string | null
          font_suggestion?: string | null
          id?: string
          image_text?: string | null
          image_type?: Database["public"]["Enums"]["image_type"]
          observations?: string | null
          orientation?: string | null
          price_per_art?: number | null
          product_name?: string | null
          professional_photo_url?: string | null
          request_id?: string
          revision_count?: number
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
          additional_info: string | null
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
          received_at: string | null
          requester_email: string
          requester_name: string
          review_token: string
          status: Database["public"]["Enums"]["request_status"]
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          additional_info?: string | null
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
          received_at?: string | null
          requester_email: string
          requester_name: string
          review_token?: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          additional_info?: string | null
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
          received_at?: string | null
          requester_email?: string
          requester_name?: string
          review_token?: string
          status?: Database["public"]["Enums"]["request_status"]
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      briefing_reviews: {
        Row: {
          action: string
          briefing_image_id: string
          created_at: string
          id: string
          reviewed_by: string
          reviewer_comments: string | null
        }
        Insert: {
          action: string
          briefing_image_id: string
          created_at?: string
          id?: string
          reviewed_by: string
          reviewer_comments?: string | null
        }
        Update: {
          action?: string
          briefing_image_id?: string
          created_at?: string
          id?: string
          reviewed_by?: string
          reviewer_comments?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "briefing_reviews_briefing_image_id_fkey"
            columns: ["briefing_image_id"]
            isOneToOne: false
            referencedRelation: "briefing_images"
            referencedColumns: ["id"]
          },
        ]
      }
      carteirizacao_cs: {
        Row: {
          ativo: boolean
          created_at: string
          etapa_id: string
          id: string
          peso: number
          plano_id: string | null
          user_email: string
          user_name: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          etapa_id: string
          id?: string
          peso?: number
          plano_id?: string | null
          user_email: string
          user_name?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          etapa_id?: string
          id?: string
          peso?: number
          plano_id?: string | null
          user_email?: string
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carteirizacao_cs_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "carteirizacao_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carteirizacao_cs_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "carteirizacao_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      carteirizacao_etapas: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      carteirizacao_ferias: {
        Row: {
          clientes_movidos: number | null
          created_at: string
          cs_email: string
          data_fim: string
          data_inicio: string
          id: string
          motivo: string | null
          movido_ida: boolean
          movido_ida_em: string | null
          movido_volta: boolean
          movido_volta_em: string | null
          substituto_email: string
          substituto_nome: string | null
        }
        Insert: {
          clientes_movidos?: number | null
          created_at?: string
          cs_email: string
          data_fim: string
          data_inicio: string
          id?: string
          motivo?: string | null
          movido_ida?: boolean
          movido_ida_em?: string | null
          movido_volta?: boolean
          movido_volta_em?: string | null
          substituto_email: string
          substituto_nome?: string | null
        }
        Update: {
          clientes_movidos?: number | null
          created_at?: string
          cs_email?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          motivo?: string | null
          movido_ida?: boolean
          movido_ida_em?: string | null
          movido_volta?: boolean
          movido_volta_em?: string | null
          substituto_email?: string
          substituto_nome?: string | null
        }
        Relationships: []
      }
      carteirizacao_planos: {
        Row: {
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      client_field_definitions: {
        Row: {
          created_at: string | null
          db_key: string
          enum_options: string[] | null
          field_type: string
          id: string
          is_hidden: boolean | null
          is_required: boolean | null
          label: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          db_key: string
          enum_options?: string[] | null
          field_type?: string
          id?: string
          is_hidden?: boolean | null
          is_required?: boolean | null
          label: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          db_key?: string
          enum_options?: string[] | null
          field_type?: string
          id?: string
          is_hidden?: boolean | null
          is_required?: boolean | null
          label?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      client_interactions: {
        Row: {
          client_id: string
          content: string | null
          created_at: string
          created_by: string | null
          created_by_name: string | null
          id: string
          interaction_type: string
          title: string
        }
        Insert: {
          client_id: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          interaction_type?: string
          title: string
        }
        Update: {
          client_id?: string
          content?: string | null
          created_at?: string
          created_by?: string | null
          created_by_name?: string | null
          id?: string
          interaction_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes_inativos: {
        Row: {
          client_name: string | null
          client_url: string | null
          created_at: string
          data_cancelamento: string | null
          id: string
          id_curseduca: string
          motivo_cancelamento: string | null
          notas: string | null
          plano: string | null
          receita_anterior: number | null
          status_financeiro: string | null
          ultimo_cs: string | null
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          data_cancelamento?: string | null
          id?: string
          id_curseduca: string
          motivo_cancelamento?: string | null
          notas?: string | null
          plano?: string | null
          receita_anterior?: number | null
          status_financeiro?: string | null
          ultimo_cs?: string | null
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          data_cancelamento?: string | null
          id?: string
          id_curseduca?: string
          motivo_cancelamento?: string | null
          notas?: string | null
          plano?: string | null
          receita_anterior?: number | null
          status_financeiro?: string | null
          ultimo_cs?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          cliente: string | null
          created_at: string
          cs_anterior: string | null
          cs_atual: string | null
          data_da_carga: string | null
          fatura: string | null
          id: string
          id_curseduca: string | null
          plano: string | null
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          cs_anterior?: string | null
          cs_atual?: string | null
          data_da_carga?: string | null
          fatura?: string | null
          id?: string
          id_curseduca?: string | null
          plano?: string | null
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          cs_anterior?: string | null
          cs_atual?: string | null
          data_da_carga?: string | null
          fatura?: string | null
          id?: string
          id_curseduca?: string | null
          plano?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kanban_boards: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      kanban_card_positions: {
        Row: {
          board_id: string
          client_id: string
          column_id: string | null
          created_at: string
          id: string
        }
        Insert: {
          board_id: string
          client_id: string
          column_id?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          board_id?: string
          client_id?: string
          column_id?: string | null
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_card_positions_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_card_positions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kanban_card_positions_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "kanban_columns"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          board_id: string | null
          color: string
          created_at: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          board_id?: string | null
          color?: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          board_id?: string | null
          color?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "kanban_boards"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_csat: {
        Row: {
          client_email: string
          client_name: string | null
          comment: string | null
          created_at: string
          id: string
          meeting_id: string
          responded_at: string | null
          score: number | null
          sent_at: string
          token: string
        }
        Insert: {
          client_email: string
          client_name?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string
          token?: string
        }
        Update: {
          client_email?: string
          client_name?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          responded_at?: string | null
          score?: number | null
          sent_at?: string
          token?: string
        }
        Relationships: []
      }
      meeting_minutes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          loyalty_stars: number
          meeting_id: string
          observations: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          loyalty_stars: number
          meeting_id: string
          observations?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          loyalty_stars?: number
          meeting_id?: string
          observations?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_minutes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: true
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_reschedules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          meeting_id: string
          new_date: string
          new_time: string
          previous_date: string
          previous_time: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id: string
          new_date: string
          new_time: string
          previous_date: string
          previous_time: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          meeting_id?: string
          new_date?: string
          new_time?: string
          previous_date?: string
          previous_time?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_reschedules_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meetings: {
        Row: {
          client_email: string | null
          client_name: string | null
          client_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number
          funil_notas: string | null
          funil_status: string | null
          gcal_event_id: string | null
          id: string
          loyalty_index: number | null
          loyalty_reason: string | null
          meeting_date: string
          meeting_reason: string | null
          meeting_time: string
          meeting_url: string | null
          minutes_url: string | null
          notes: string | null
          participants: string[] | null
          recording_url: string | null
          reminder_sent_at: string | null
          reschedule_reason: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          client_email?: string | null
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          funil_notas?: string | null
          funil_status?: string | null
          gcal_event_id?: string | null
          id?: string
          loyalty_index?: number | null
          loyalty_reason?: string | null
          meeting_date: string
          meeting_reason?: string | null
          meeting_time: string
          meeting_url?: string | null
          minutes_url?: string | null
          notes?: string | null
          participants?: string[] | null
          recording_url?: string | null
          reminder_sent_at?: string | null
          reschedule_reason?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          client_email?: string | null
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number
          funil_notas?: string | null
          funil_status?: string | null
          gcal_event_id?: string | null
          id?: string
          loyalty_index?: number | null
          loyalty_reason?: string | null
          meeting_date?: string
          meeting_reason?: string | null
          meeting_time?: string
          meeting_url?: string | null
          minutes_url?: string | null
          notes?: string | null
          participants?: string[] | null
          recording_url?: string | null
          reminder_sent_at?: string | null
          reschedule_reason?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      migration_clubs: {
        Row: {
          club_name: string | null
          club_url: string
          created_at: string | null
          id: string
          submission_id: string
        }
        Insert: {
          club_name?: string | null
          club_url: string
          created_at?: string | null
          id?: string
          submission_id: string
        }
        Update: {
          club_name?: string | null
          club_url?: string
          created_at?: string | null
          id?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_clubs_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "migration_form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_form_submissions: {
        Row: {
          api_basic: string | null
          api_client_id: string | null
          api_client_secret: string | null
          created_at: string | null
          id: string
          is_resubmission: boolean | null
          members_spreadsheet_name: string | null
          members_spreadsheet_url: string | null
          project_id: string
          submitted_at: string | null
        }
        Insert: {
          api_basic?: string | null
          api_client_id?: string | null
          api_client_secret?: string | null
          created_at?: string | null
          id?: string
          is_resubmission?: boolean | null
          members_spreadsheet_name?: string | null
          members_spreadsheet_url?: string | null
          project_id: string
          submitted_at?: string | null
        }
        Update: {
          api_basic?: string | null
          api_client_id?: string | null
          api_client_secret?: string | null
          created_at?: string | null
          id?: string
          is_resubmission?: boolean | null
          members_spreadsheet_name?: string | null
          members_spreadsheet_url?: string | null
          project_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_form_submissions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "migration_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_projects: {
        Row: {
          client_email: string
          client_name: string
          client_url: string
          created_at: string | null
          created_by: string | null
          cs_observations: string | null
          cs_responsible: string | null
          has_app: boolean | null
          has_design: boolean | null
          has_migration: boolean | null
          id: string
          migration_status: string | null
          migrator_observations: string | null
          platform_origin: string
          portal_token: string | null
          rejected_tag: boolean | null
          updated_at: string | null
        }
        Insert: {
          client_email: string
          client_name: string
          client_url: string
          created_at?: string | null
          created_by?: string | null
          cs_observations?: string | null
          cs_responsible?: string | null
          has_app?: boolean | null
          has_design?: boolean | null
          has_migration?: boolean | null
          id?: string
          migration_status?: string | null
          migrator_observations?: string | null
          platform_origin?: string
          portal_token?: string | null
          rejected_tag?: boolean | null
          updated_at?: string | null
        }
        Update: {
          client_email?: string
          client_name?: string
          client_url?: string
          created_at?: string | null
          created_by?: string | null
          cs_observations?: string | null
          cs_responsible?: string | null
          has_app?: boolean | null
          has_design?: boolean | null
          has_migration?: boolean | null
          id?: string
          migration_status?: string | null
          migrator_observations?: string | null
          platform_origin?: string
          portal_token?: string | null
          rejected_tag?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      migration_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          notes: string | null
          project_id: string
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          project_id: string
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "migration_status_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "migration_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      migration_validations: {
        Row: {
          created_at: string | null
          id: string
          item_key: string
          observation: string | null
          project_id: string
          status: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_key: string
          observation?: string | null
          project_id: string
          status?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_key?: string
          observation?: string | null
          project_id?: string
          status?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "migration_validations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "migration_projects"
            referencedColumns: ["id"]
          },
        ]
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
      reversao_tracking: {
        Row: {
          client_name: string | null
          client_url: string | null
          created_at: string
          id: string
          meeting_id: string
          notas: string | null
          status: string
          status_changed_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          id?: string
          meeting_id: string
          notas?: string | null
          status?: string
          status_changed_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          id?: string
          meeting_id?: string
          notas?: string | null
          status?: string
          status_changed_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id?: string
          permission: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          permission?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      scorm_packages: {
        Row: {
          client_name: string | null
          created_at: string
          created_by: string | null
          description: string | null
          entry_point: string
          file_count: number
          file_size_bytes: number
          id: string
          platform_url: string | null
          storage_path: string
          title: string
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_point: string
          file_count?: number
          file_size_bytes?: number
          id?: string
          platform_url?: string | null
          storage_path: string
          title: string
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_point?: string
          file_count?: number
          file_size_bytes?: number
          id?: string
          platform_url?: string | null
          storage_path?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      upsell_tracking: {
        Row: {
          client_name: string | null
          client_url: string | null
          created_at: string
          data_pagamento: string | null
          id: string
          id_curseduca: string
          status: string
          tipo: string
          updated_at: string
          updated_by: string | null
          valor_pagamento: number | null
        }
        Insert: {
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          id?: string
          id_curseduca: string
          status?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
          valor_pagamento?: number | null
        }
        Update: {
          client_name?: string | null
          client_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          id?: string
          id_curseduca?: string
          status?: string
          tipo?: string
          updated_at?: string
          updated_by?: string | null
          valor_pagamento?: number | null
        }
        Relationships: []
      }
      user_managers: {
        Row: {
          created_at: string
          id: string
          manager_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          manager_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          manager_id?: string
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
      add_client_column: {
        Args: { col_name: string; col_type?: string }
        Returns: undefined
      }
      criar_fases_cliente: {
        Args: { p_cliente_id: string; p_plataforma: string }
        Returns: undefined
      }
      get_client_columns: {
        Args: never
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      verificar_prazos_lojas: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "member"
        | "designer"
        | "cs"
        | "implantacao"
        | "gerente_cs"
        | "gerente_implantacao"
        | "cliente"
        | "analista_implantacao"
        | "migrador"
      image_type:
        | "login"
        | "banner_vitrine"
        | "product_cover"
        | "trail_banner"
        | "challenge_banner"
        | "community_banner"
        | "app_mockup"
      request_status:
        | "pending"
        | "in_progress"
        | "review"
        | "completed"
        | "cancelled"
        | "revision"
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
      app_role: [
        "admin",
        "member",
        "designer",
        "cs",
        "implantacao",
        "gerente_cs",
        "gerente_implantacao",
        "cliente",
        "analista_implantacao",
        "migrador",
      ],
      image_type: [
        "login",
        "banner_vitrine",
        "product_cover",
        "trail_banner",
        "challenge_banner",
        "community_banner",
        "app_mockup",
      ],
      request_status: [
        "pending",
        "in_progress",
        "review",
        "completed",
        "cancelled",
        "revision",
      ],
    },
  },
} as const
