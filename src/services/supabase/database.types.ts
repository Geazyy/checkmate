export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type CloudTable = 'checkmate_exams' | 'checkmate_answer_keys' | 'checkmate_classes' | 'checkmate_rosters' | 'checkmate_scans' | 'checkmate_preferences' | 'checkmate_templates';
export type CloudRow = {
  id: string; owner_id: string; local_id: string; data: Json; version: number;
  mutation_id: string; updated_at: string; deleted_at: string | null;
}
export type ProfileRow = {
  id: string; full_name: string; school_name: string; teacher_id: string; phone: string;
  avatar_path: string | null; role: 'teacher' | 'instructor'; created_at: string; updated_at: string;
}
type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
export type Database = {
  public: {
    Tables: { profiles: Table<ProfileRow> } & { [K in CloudTable]: Table<CloudRow> };
    Views: Record<string, never>;
    Functions: {
      checkmate_write: { Args: { p_table: string; p_id: string; p_local_id: string; p_data: Json; p_version: number; p_mutation: string; p_deleted: boolean }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
