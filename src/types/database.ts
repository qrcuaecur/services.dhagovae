/**
 * Hand-authored to mirror supabase/migrations/20260911000000_init_schema.sql.
 * Keep in sync when the migration changes.
 */

export type DocumentStatus = "active" | "archived" | "expired";
export type UserRole = "admin" | "super_admin" | "editor" | "viewer";

export type DocumentRow = {
  id: string;
  title: string;
  description: string;
  document_number: string | null;
  category: string | null;
  tags: string[];
  version: string | null;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  storage_bucket: string;
  status: DocumentStatus;
  expires_at: string | null;
  deleted_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentInsert = Omit<DocumentRow, "created_at" | "updated_at" | "tags" | "description"> & {
  tags?: string[];
  description?: string;
  created_at?: string;
  updated_at?: string;
};

export type DocumentUpdate = Partial<Omit<DocumentRow, "id" | "created_at">>;

export type ProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type AccessLogRow = {
  id: string;
  document_id: string;
  accessed_at: string;
  user_agent: string | null;
  device_type: string | null;
  country: string | null;
};

export type Database = {
  public: {
    Tables: {
      documents: {
        Row: DocumentRow;
        Insert: DocumentInsert;
        Update: DocumentUpdate;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, "created_at" | "updated_at"> & {
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Omit<ProfileRow, "id">>;
        Relationships: [];
      };
      document_access_logs: {
        Row: AccessLogRow;
        Insert: Omit<AccessLogRow, "id" | "accessed_at"> & {
          id?: string;
          accessed_at?: string;
        };
        Update: Partial<AccessLogRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: {
        Args: Record<never, never>;
        Returns: boolean;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
