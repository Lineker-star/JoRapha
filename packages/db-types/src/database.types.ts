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
  api: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      break_glass: {
        Args: {
          p_patient_id: string
          p_practitioner_role_id: string
          p_reason: string
        }
        Returns: string
      }
      end_membership: {
        Args: { p_membership_id: string; p_reason: string }
        Returns: undefined
      }
      grant_membership: {
        Args: {
          p_organization_id?: string
          p_role: string
          p_user_account_id: string
          p_valid_from?: string
          p_valid_to?: string
        }
        Returns: string
      }
      record_consent: {
        Args: {
          p_client_created_at?: string
          p_consent_id: string
          p_device_id?: string
          p_evidence_object_path?: string
          p_grantor_related_person_id?: string
          p_legal_basis?: string
          p_locale?: string
          p_patient_id: string
          p_period_end?: string
          p_policy_text_version: string
          p_purpose: string
          p_recipient_organization_id?: string
          p_recipient_practitioner_role_id?: string
          p_scope_categories?: string[]
        }
        Returns: string
      }
      register_device: {
        Args: {
          p_app: string
          p_app_version?: string
          p_client_created_at?: string
          p_device_id: string
          p_platform: string
        }
        Returns: string
      }
      revoke_device: {
        Args: { p_device_id: string; p_reason: string }
        Returns: undefined
      }
      withdraw_consent: {
        Args: {
          p_client_created_at?: string
          p_consent_id: string
          p_device_id?: string
          p_grantor_related_person_id?: string
          p_reason: string
          p_withdrawal_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  audit: {
    Tables: {
      audit_event: {
        Row: {
          action: string
          actor_role: string | null
          actor_user_id: string | null
          client_created_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          device_id: string | null
          entity_id: string | null
          entity_schema: string
          entity_table: string
          id: string
          occurred_at: string
          on_behalf_of_patient_id: string | null
          outcome: string
          patient_id: string | null
          purpose_of_use: string | null
          reason: string | null
          row_version: number
          updated_at: string
        }
        Insert: {
          action: string
          actor_role?: string | null
          actor_user_id?: string | null
          client_created_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          entity_id?: string | null
          entity_schema: string
          entity_table: string
          id?: string
          occurred_at?: string
          on_behalf_of_patient_id?: string | null
          outcome?: string
          patient_id?: string | null
          purpose_of_use?: string | null
          reason?: string | null
          row_version?: number
          updated_at?: string
        }
        Update: {
          action?: string
          actor_role?: string | null
          actor_user_id?: string | null
          client_created_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string | null
          entity_id?: string | null
          entity_schema?: string
          entity_table?: string
          id?: string
          occurred_at?: string
          on_behalf_of_patient_id?: string | null
          outcome?: string
          patient_id?: string | null
          purpose_of_use?: string | null
          reason?: string | null
          row_version?: number
          updated_at?: string
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
  billing: {
    Tables: {
      [_ in never]: never
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
  clinical: {
    Tables: {
      care_relationship: {
        Row: {
          basis: string
          basis_ref_id: string | null
          client_created_at: string | null
          created_at: string
          created_by: string | null
          end_reason: string | null
          ended_by: string | null
          id: string
          patient_id: string
          practitioner_role_id: string
          reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          row_version: number
          status: string
          updated_at: string
          valid_from: string
          valid_to: string
        }
        Insert: {
          basis: string
          basis_ref_id?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          patient_id: string
          practitioner_role_id: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_version?: number
          status?: string
          updated_at?: string
          valid_from?: string
          valid_to: string
        }
        Update: {
          basis?: string
          basis_ref_id?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          end_reason?: string | null
          ended_by?: string | null
          id?: string
          patient_id?: string
          practitioner_role_id?: string
          reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          row_version?: number
          status?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string
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
  community: {
    Tables: {
      catchment: {
        Row: {
          area: unknown
          client_created_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          row_version: number
          status: string
          updated_at: string
        }
        Insert: {
          area?: unknown
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          row_version?: number
          status?: string
          updated_at?: string
        }
        Update: {
          area?: unknown
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          row_version?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chw_assignment: {
        Row: {
          catchment_id: string
          client_created_at: string | null
          created_at: string
          created_by: string | null
          id: string
          row_version: number
          status: string
          supervisor_user_id: string | null
          updated_at: string
          user_account_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          catchment_id: string
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          row_version?: number
          status?: string
          supervisor_user_id?: string | null
          updated_at?: string
          user_account_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          catchment_id?: string
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          row_version?: number
          status?: string
          supervisor_user_id?: string | null
          updated_at?: string
          user_account_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chw_assignment_catchment_id_fkey"
            columns: ["catchment_id"]
            isOneToOne: false
            referencedRelation: "catchment"
            referencedColumns: ["id"]
          },
        ]
      }
      household: {
        Row: {
          catchment_id: string
          client_created_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name_or_head: string | null
          origin_device_id: string | null
          position: unknown
          row_version: number
          status: string
          updated_at: string
          village: string | null
        }
        Insert: {
          catchment_id: string
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name_or_head?: string | null
          origin_device_id?: string | null
          position?: unknown
          row_version?: number
          status?: string
          updated_at?: string
          village?: string | null
        }
        Update: {
          catchment_id?: string
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name_or_head?: string | null
          origin_device_id?: string | null
          position?: unknown
          row_version?: number
          status?: string
          updated_at?: string
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_catchment_id_fkey"
            columns: ["catchment_id"]
            isOneToOne: false
            referencedRelation: "catchment"
            referencedColumns: ["id"]
          },
        ]
      }
      household_member: {
        Row: {
          client_created_at: string | null
          created_at: string
          created_by: string | null
          household_id: string
          id: string
          origin_device_id: string | null
          patient_id: string
          relationship_to_head: string | null
          row_version: number
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          household_id: string
          id?: string
          origin_device_id?: string | null
          patient_id: string
          relationship_to_head?: string | null
          row_version?: number
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          household_id?: string
          id?: string
          origin_device_id?: string | null
          patient_id?: string
          relationship_to_head?: string | null
          row_version?: number
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "household_member_household_id_fkey"
            columns: ["household_id"]
            isOneToOne: false
            referencedRelation: "household"
            referencedColumns: ["id"]
          },
        ]
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
  content: {
    Tables: {
      [_ in never]: never
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
  identity: {
    Tables: {
      device_registration: {
        Row: {
          app: string
          app_version: string | null
          client_created_at: string | null
          created_at: string
          created_by: string | null
          id: string
          last_sync_at: string | null
          platform: string
          public_key: string | null
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          row_version: number
          trust_status: string
          updated_at: string
          user_account_id: string
        }
        Insert: {
          app: string
          app_version?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id: string
          last_sync_at?: string | null
          platform: string
          public_key?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          row_version?: number
          trust_status?: string
          updated_at?: string
          user_account_id: string
        }
        Update: {
          app?: string
          app_version?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          last_sync_at?: string | null
          platform?: string
          public_key?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          row_version?: number
          trust_status?: string
          updated_at?: string
          user_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_registration_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_registration_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_registration_user_account_id_fkey"
            columns: ["user_account_id"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
        ]
      }
      membership: {
        Row: {
          client_created_at: string | null
          created_at: string
          created_by: string | null
          end_reason: string | null
          granted_by: string | null
          id: string
          organization_id: string | null
          role: string
          row_version: number
          status: string
          updated_at: string
          user_account_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          end_reason?: string | null
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          role: string
          row_version?: number
          status?: string
          updated_at?: string
          user_account_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          end_reason?: string | null
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          role?: string
          row_version?: number
          status?: string
          updated_at?: string
          user_account_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "membership_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "membership_user_account_id_fkey"
            columns: ["user_account_id"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
        ]
      }
      person: {
        Row: {
          birth_date: string | null
          birth_date_precision: string
          client_created_at: string | null
          created_at: string
          created_by: string | null
          district: string | null
          email: string | null
          family_name: string
          given_names: string
          id: string
          origin_device_id: string | null
          other_names: string | null
          phone: string | null
          preferred_language: string | null
          region: string | null
          row_version: number
          sex: string
          status: string
          updated_at: string
          user_account_id: string | null
          village_or_quarter: string | null
        }
        Insert: {
          birth_date?: string | null
          birth_date_precision?: string
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          family_name: string
          given_names: string
          id?: string
          origin_device_id?: string | null
          other_names?: string | null
          phone?: string | null
          preferred_language?: string | null
          region?: string | null
          row_version?: number
          sex?: string
          status?: string
          updated_at?: string
          user_account_id?: string | null
          village_or_quarter?: string | null
        }
        Update: {
          birth_date?: string | null
          birth_date_precision?: string
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          district?: string | null
          email?: string | null
          family_name?: string
          given_names?: string
          id?: string
          origin_device_id?: string | null
          other_names?: string | null
          phone?: string | null
          preferred_language?: string | null
          region?: string | null
          row_version?: number
          sex?: string
          status?: string
          updated_at?: string
          user_account_id?: string | null
          village_or_quarter?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_origin_device_id_fkey"
            columns: ["origin_device_id"]
            isOneToOne: false
            referencedRelation: "device_registration"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_user_account_id_fkey"
            columns: ["user_account_id"]
            isOneToOne: true
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
        ]
      }
      user_account: {
        Row: {
          client_created_at: string | null
          created_at: string
          created_by: string | null
          id: string
          preferred_locale: string
          row_version: number
          status: string
          suspended_reason: string | null
          updated_at: string
        }
        Insert: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id: string
          preferred_locale?: string
          row_version?: number
          status?: string
          suspended_reason?: string | null
          updated_at?: string
        }
        Update: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          preferred_locale?: string
          row_version?: number
          status?: string
          suspended_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_account_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_account"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aal2: { Args: never; Returns: boolean }
      current_person_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      has_role: {
        Args: { p_organization_id?: string; p_role: string }
        Returns: boolean
      }
      in_org: { Args: { p_organization_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  lab: {
    Tables: {
      [_ in never]: never
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
  patient: {
    Tables: {
      consent: {
        Row: {
          client_created_at: string | null
          created_at: string
          created_by: string | null
          evidence_object_path: string | null
          grantor_kind: string
          grantor_related_person_id: string | null
          id: string
          legal_basis: string | null
          locale: string
          origin_device_id: string | null
          patient_id: string
          period_end: string | null
          period_start: string
          policy_text_version: string
          purpose: string
          recipient_organization_id: string | null
          recipient_practitioner_role_id: string | null
          recorded_by: string | null
          row_version: number
          scope_categories: string[]
          status: string
          supersedes_id: string | null
          updated_at: string
        }
        Insert: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          evidence_object_path?: string | null
          grantor_kind?: string
          grantor_related_person_id?: string | null
          id?: string
          legal_basis?: string | null
          locale?: string
          origin_device_id?: string | null
          patient_id: string
          period_end?: string | null
          period_start?: string
          policy_text_version: string
          purpose: string
          recipient_organization_id?: string | null
          recipient_practitioner_role_id?: string | null
          recorded_by?: string | null
          row_version?: number
          scope_categories?: string[]
          status?: string
          supersedes_id?: string | null
          updated_at?: string
        }
        Update: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          evidence_object_path?: string | null
          grantor_kind?: string
          grantor_related_person_id?: string | null
          id?: string
          legal_basis?: string | null
          locale?: string
          origin_device_id?: string | null
          patient_id?: string
          period_end?: string | null
          period_start?: string
          policy_text_version?: string
          purpose?: string
          recipient_organization_id?: string | null
          recipient_practitioner_role_id?: string | null
          recorded_by?: string | null
          row_version?: number
          scope_categories?: string[]
          status?: string
          supersedes_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_grantor_related_person_id_fkey"
            columns: ["grantor_related_person_id"]
            isOneToOne: false
            referencedRelation: "related_person"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: true
            referencedRelation: "consent"
            referencedColumns: ["id"]
          },
        ]
      }
      patient: {
        Row: {
          assistance_authorization_basis: string | null
          assisted_by_user_id: string | null
          client_created_at: string | null
          created_at: string
          created_by: string | null
          deceased_at: string | null
          id: string
          merged_into_id: string | null
          origin_device_id: string | null
          person_id: string
          registered_at_organization_id: string | null
          registration_channel: string
          row_version: number
          status: string
          status_changed_by: string | null
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          assistance_authorization_basis?: string | null
          assisted_by_user_id?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          deceased_at?: string | null
          id?: string
          merged_into_id?: string | null
          origin_device_id?: string | null
          person_id: string
          registered_at_organization_id?: string | null
          registration_channel?: string
          row_version?: number
          status?: string
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          assistance_authorization_basis?: string | null
          assisted_by_user_id?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          deceased_at?: string | null
          id?: string
          merged_into_id?: string | null
          origin_device_id?: string | null
          person_id?: string
          registered_at_organization_id?: string | null
          registration_channel?: string
          row_version?: number
          status?: string
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_identifier: {
        Row: {
          assigner_organization_id: string | null
          client_created_at: string | null
          created_at: string
          created_by: string | null
          id: string
          origin_device_id: string | null
          patient_id: string
          period_end: string | null
          period_start: string | null
          row_version: number
          status: string
          system: string
          updated_at: string
          value_encrypted: string | null
          value_hash: string | null
          value_masked: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          assigner_organization_id?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          origin_device_id?: string | null
          patient_id: string
          period_end?: string | null
          period_start?: string | null
          row_version?: number
          status?: string
          system: string
          updated_at?: string
          value_encrypted?: string | null
          value_hash?: string | null
          value_masked?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          assigner_organization_id?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          origin_device_id?: string | null
          patient_id?: string
          period_end?: string | null
          period_start?: string | null
          row_version?: number
          status?: string
          system?: string
          updated_at?: string
          value_encrypted?: string | null
          value_hash?: string | null
          value_masked?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_identifier_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
        ]
      }
      related_person: {
        Row: {
          authority_scope: string[]
          client_created_at: string | null
          created_at: string
          created_by: string | null
          evidence_object_path: string | null
          id: string
          legal_basis: string | null
          origin_device_id: string | null
          patient_id: string
          person_id: string
          relationship: string
          revocation_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          row_version: number
          updated_at: string
          valid_from: string
          valid_to: string | null
          verification_method: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          authority_scope?: string[]
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          evidence_object_path?: string | null
          id?: string
          legal_basis?: string | null
          origin_device_id?: string | null
          patient_id: string
          person_id: string
          relationship: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          row_version?: number
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          verification_method?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          authority_scope?: string[]
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          evidence_object_path?: string | null
          id?: string
          legal_basis?: string | null
          origin_device_id?: string | null
          patient_id?: string
          person_id?: string
          relationship?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          row_version?: number
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
          verification_method?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "related_person_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patient"
            referencedColumns: ["id"]
          },
        ]
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
  pharmacy: {
    Tables: {
      [_ in never]: never
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
  provider: {
    Tables: {
      credential: {
        Row: {
          client_created_at: string | null
          created_at: string
          created_by: string | null
          evidence_object_path: string | null
          expires_on: string | null
          id: string
          issued_on: string | null
          issuer: string
          kind: string
          next_review_on: string | null
          number: string | null
          practitioner_id: string
          row_version: number
          specialty_code: string | null
          updated_at: string
          verification_source: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          evidence_object_path?: string | null
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuer: string
          kind: string
          next_review_on?: string | null
          number?: string | null
          practitioner_id: string
          row_version?: number
          specialty_code?: string | null
          updated_at?: string
          verification_source?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          evidence_object_path?: string | null
          expires_on?: string | null
          id?: string
          issued_on?: string | null
          issuer?: string
          kind?: string
          next_review_on?: string | null
          number?: string | null
          practitioner_id?: string
          row_version?: number
          specialty_code?: string | null
          updated_at?: string
          verification_source?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credential_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioner"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_service: {
        Row: {
          category: string
          channels: string[]
          client_created_at: string | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          organization_id: string
          price_source: string | null
          price_updated_at: string | null
          price_xaf: number | null
          row_version: number
          specialty_code: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          channels?: string[]
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          organization_id: string
          price_source?: string | null
          price_updated_at?: string | null
          price_xaf?: number | null
          row_version?: number
          specialty_code?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          channels?: string[]
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          organization_id?: string
          price_source?: string | null
          price_updated_at?: string | null
          price_xaf?: number | null
          row_version?: number
          specialty_code?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_service_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_service_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      location: {
        Row: {
          address_text: string | null
          client_created_at: string | null
          created_at: string
          created_by: string | null
          department: string | null
          district: string | null
          id: string
          name: string
          opening_hours: Json | null
          opening_hours_updated_at: string | null
          organization_id: string
          position: unknown
          position_source: string | null
          region: string | null
          row_version: number
          status: string
          updated_at: string
        }
        Insert: {
          address_text?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          district?: string | null
          id?: string
          name: string
          opening_hours?: Json | null
          opening_hours_updated_at?: string | null
          organization_id: string
          position?: unknown
          position_source?: string | null
          region?: string | null
          row_version?: number
          status?: string
          updated_at?: string
        }
        Update: {
          address_text?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          district?: string | null
          id?: string
          name?: string
          opening_hours?: Json | null
          opening_hours_updated_at?: string | null
          organization_id?: string
          position?: unknown
          position_source?: string | null
          region?: string | null
          row_version?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      organization: {
        Row: {
          client_created_at: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          kind: string
          licence_evidence_path: string | null
          licence_number: string | null
          name: string
          part_of_id: string | null
          phone: string | null
          row_version: number
          status: string
          updated_at: string
          verification_status: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kind: string
          licence_evidence_path?: string | null
          licence_number?: string | null
          name: string
          part_of_id?: string | null
          phone?: string | null
          row_version?: number
          status?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kind?: string
          licence_evidence_path?: string | null
          licence_number?: string | null
          name?: string
          part_of_id?: string | null
          phone?: string | null
          row_version?: number
          status?: string
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_part_of_id_fkey"
            columns: ["part_of_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner: {
        Row: {
          client_created_at: string | null
          created_at: string
          created_by: string | null
          display_name: string
          id: string
          next_reverification_due: string | null
          person_id: string
          row_version: number
          status: string
          suspension_reason: string | null
          updated_at: string
          verification_status: string
        }
        Insert: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          display_name: string
          id?: string
          next_reverification_due?: string | null
          person_id: string
          row_version?: number
          status?: string
          suspension_reason?: string | null
          updated_at?: string
          verification_status?: string
        }
        Update: {
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string
          id?: string
          next_reverification_due?: string | null
          person_id?: string
          row_version?: number
          status?: string
          suspension_reason?: string | null
          updated_at?: string
          verification_status?: string
        }
        Relationships: []
      }
      practitioner_role: {
        Row: {
          approved_by: string | null
          client_created_at: string | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          organization_id: string
          permitted_service_categories: string[]
          practitioner_id: string
          role_code: string
          row_version: number
          specialty_code: string | null
          status: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          approved_by?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          organization_id: string
          permitted_service_categories?: string[]
          practitioner_id: string
          role_code: string
          row_version?: number
          specialty_code?: string | null
          status?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          approved_by?: string | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          organization_id?: string
          permitted_service_categories?: string[]
          practitioner_id?: string
          role_code?: string
          row_version?: number
          specialty_code?: string | null
          status?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_role_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_role_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_role_practitioner_id_fkey"
            columns: ["practitioner_id"]
            isOneToOne: false
            referencedRelation: "practitioner"
            referencedColumns: ["id"]
          },
        ]
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
  public: {
    Tables: {
      [_ in never]: never
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
  referral: {
    Tables: {
      [_ in never]: never
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
  scheduling: {
    Tables: {
      [_ in never]: never
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
  sync: {
    Tables: {
      conflict: {
        Row: {
          client_created_at: string | null
          client_values_encrypted: string | null
          created_at: string
          created_by: string | null
          entity_id: string
          entity_table: string
          fields: string[]
          id: string
          operation_id: string
          resolved_at: string | null
          resolved_by: string | null
          row_version: number
          server_row_version: number | null
          status: string
          updated_at: string
        }
        Insert: {
          client_created_at?: string | null
          client_values_encrypted?: string | null
          created_at?: string
          created_by?: string | null
          entity_id: string
          entity_table: string
          fields?: string[]
          id?: string
          operation_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          row_version?: number
          server_row_version?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_created_at?: string | null
          client_values_encrypted?: string | null
          created_at?: string
          created_by?: string | null
          entity_id?: string
          entity_table?: string
          fields?: string[]
          id?: string
          operation_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          row_version?: number
          server_row_version?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conflict_operation_id_fkey"
            columns: ["operation_id"]
            isOneToOne: true
            referencedRelation: "operation"
            referencedColumns: ["id"]
          },
        ]
      }
      operation: {
        Row: {
          applied_at: string | null
          base_row_version: number | null
          client_created_at: string | null
          created_at: string
          created_by: string | null
          device_id: string
          entity_id: string
          entity_table: string
          id: string
          idempotency_key: string
          local_sequence: number
          op: string
          payload_sha256: string
          reason_code: string | null
          received_at: string
          result: Json | null
          row_version: number
          schema_version: number
          state: string
          updated_at: string
          user_account_id: string
        }
        Insert: {
          applied_at?: string | null
          base_row_version?: number | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          device_id: string
          entity_id: string
          entity_table: string
          id: string
          idempotency_key: string
          local_sequence: number
          op: string
          payload_sha256: string
          reason_code?: string | null
          received_at?: string
          result?: Json | null
          row_version?: number
          schema_version: number
          state?: string
          updated_at?: string
          user_account_id: string
        }
        Update: {
          applied_at?: string | null
          base_row_version?: number | null
          client_created_at?: string | null
          created_at?: string
          created_by?: string | null
          device_id?: string
          entity_id?: string
          entity_table?: string
          id?: string
          idempotency_key?: string
          local_sequence?: number
          op?: string
          payload_sha256?: string
          reason_code?: string | null
          received_at?: string
          result?: Json | null
          row_version?: number
          schema_version?: number
          state?: string
          updated_at?: string
          user_account_id?: string
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
  api: {
    Enums: {},
  },
  audit: {
    Enums: {},
  },
  billing: {
    Enums: {},
  },
  clinical: {
    Enums: {},
  },
  community: {
    Enums: {},
  },
  content: {
    Enums: {},
  },
  identity: {
    Enums: {},
  },
  lab: {
    Enums: {},
  },
  patient: {
    Enums: {},
  },
  pharmacy: {
    Enums: {},
  },
  provider: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  referral: {
    Enums: {},
  },
  scheduling: {
    Enums: {},
  },
  sync: {
    Enums: {},
  },
} as const
