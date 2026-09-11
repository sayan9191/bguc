export const SUPABASE_URL = "https://bizgybbywllbnuyvcaua.supabase.co";

// Publishable anon key. Safe in the browser: it carries no privileges of its
// own and every table is protected by row level security.
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpemd5YmJ5d2xsYm51eXZjYXVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTk1MTIsImV4cCI6MjEwNDY3NTUxMn0._sEF-s-2gFrnGzW-IKbumaPxMIhqIzmD-PHY7etXAjI";

// No organiser credential lives in this repo. The password is stored in
// Supabase as a bcrypt hash and checked by the organiser_login function.

export const COLS =
  "id, project_code, model_name, description, category, class_group, cover_image_url, video_url, school_name, class_name, team_display_names, mentor_name, approval_status";
