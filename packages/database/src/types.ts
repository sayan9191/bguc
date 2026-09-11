export type UserRole = "student" | "admin" | "voter";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ProjectCategory = "Science";
export type ClassGroup = "A" | "B";
export type MediaType = "image" | "video";

export type Profile = {
  id: string;
  full_name: string;
  email: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type Student = {
  id: string;
  profile_id: string | null;
  student_names: string;
  class_name: string;
  class_group: ClassGroup;
  school_name: string;
  contact_number: string | null;
  whatsapp_number: string | null;
  mentor_name: string | null;
  guardian_name: string | null;
  guardian_contact: string | null;
  import_fingerprint: string | null;
  original_registration_at: string | null;
  raw_import: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  project_code: string;
  model_name: string;
  description: string | null;
  category: ProjectCategory;
  class_group: ClassGroup;
  student_id: string | null;
  approval_status: ApprovalStatus;
  cover_image_url: string | null;
  video_url: string | null;
  school_name: string | null;
  class_name: string | null;
  team_display_names: string | null;
  mentor_name: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectMember = {
  id: string;
  project_id: string;
  student_name: string;
  class_name: string | null;
  school_name: string | null;
  created_at: string;
};

export type ProjectMedia = {
  id: string;
  project_id: string;
  media_url: string;
  media_type: MediaType;
  sort_order: number;
  created_at: string;
};

export type Voter = {
  id: string;
  auth_user_id: string;
  created_at: string;
};

export type Vote = {
  id: string;
  voter_id: string;
  project_id: string;
  created_at: string;
};

export type ExhibitionSettings = {
  id: number;
  exhibition_name: string;
  voting_enabled: boolean;
  voting_start: string | null;
  voting_end: string | null;
  results_visible: boolean;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  admin_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type VoteAttempt = {
  id: string;
  auth_user_id: string | null;
  project_id: string | null;
  outcome: string;
  created_at: string;
};

export type PublicProject = Pick<
  Project,
  | "id"
  | "project_code"
  | "model_name"
  | "description"
  | "category"
  | "cover_image_url"
  | "video_url"
  | "school_name"
  | "class_name"
  | "team_display_names"
  | "mentor_name"
  | "approval_status"
> & {
  vote_count?: number | null;
  project_members?: ProjectMember[];
  project_media?: ProjectMedia[];
};

export type VoteResultCode =
  | "success"
  | "unauthenticated"
  | "already_voted"
  | "disabled"
  | "not_started"
  | "ended"
  | "unavailable"
  | "rate_limited"
  | "unauthorized"
  | "turnstile";

export type VoteRpcResult = {
  ok: boolean;
  code: VoteResultCode;
  message: string;
  project_id?: string;
};

type Rel = { foreignKeyName: string; columns: string[]; isOneToOne: boolean; referencedRelation: string; referencedColumns: string[] };

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile>; Relationships: Rel[] };
      students: { Row: Student; Insert: Partial<Student>; Update: Partial<Student>; Relationships: Rel[] };
      projects: { Row: Project; Insert: Partial<Project> & { model_name: string; category: ProjectCategory }; Update: Partial<Project>; Relationships: Rel[] };
      project_members: { Row: ProjectMember; Insert: Partial<ProjectMember> & { project_id: string; student_name: string }; Update: Partial<ProjectMember>; Relationships: Rel[] };
      project_media: { Row: ProjectMedia; Insert: Partial<ProjectMedia> & { project_id: string; media_url: string; media_type: MediaType }; Update: Partial<ProjectMedia>; Relationships: Rel[] };
      voters: { Row: Voter; Insert: Partial<Voter> & { auth_user_id: string }; Update: Partial<Voter>; Relationships: Rel[] };
      votes: { Row: Vote; Insert: Partial<Vote> & { voter_id: string; project_id: string }; Update: Partial<Vote>; Relationships: Rel[] };
      exhibition_settings: { Row: ExhibitionSettings; Insert: Partial<ExhibitionSettings>; Update: Partial<ExhibitionSettings>; Relationships: Rel[] };
      audit_logs: { Row: AuditLog; Insert: Partial<AuditLog> & { action: string; entity_type: string }; Update: Partial<AuditLog>; Relationships: Rel[] };
      vote_attempts: { Row: VoteAttempt; Insert: Partial<VoteAttempt>; Update: Partial<VoteAttempt>; Relationships: Rel[] };
    };
    Views: Record<string, never>;
    Functions: {
      submit_vote: { Args: { p_project_id: string }; Returns: VoteRpcResult };
      my_vote: { Args: Record<PropertyKey, never>; Returns: { voted: boolean; project_id?: string; project_name?: string } };
      public_vote_counts: { Args: Record<PropertyKey, never>; Returns: { project_id: string; vote_count: number }[] };
      student_live_rankings: {
        Args: Record<PropertyKey, never>;
        Returns: {
          project_id: string;
          model_name: string;
          class_group: string;
          school_name: string | null;
          vote_count: number;
          rank_in_group: number;
          is_mine: boolean;
        }[];
      };
      attach_student_media: { Args: { p_project_id: string; p_media_url: string; p_as_cover?: boolean }; Returns: { ok: boolean; message?: string } };
      submit_student_project: {
        Args: {
          p_model_name: string;
          p_description: string;
          p_class_group: string;
          p_team_display_names: string;
          p_project_id?: string | null;
          p_mentor_name?: string | null;
        };
        Returns: { ok: boolean; project_id?: string; message?: string };
      };
      voting_window_status: { Args: Record<PropertyKey, never>; Returns: string };
      ensure_voter: { Args: Record<PropertyKey, never>; Returns: string };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      claim_student_record: { Args: { p_project_code: string; p_contact: string }; Returns: { ok: boolean; message?: string; student_id?: string } };
      register_new_student: {
        Args: {
          p_student_names: string;
          p_class_name: string;
          p_school_name: string;
          p_contact: string;
          p_whatsapp: string;
          p_guardian_name: string;
          p_guardian_contact: string;
        };
        Returns: { ok: boolean; student_id?: string };
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
