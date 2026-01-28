import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://qqhvolzqccyyhetmrfnx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxaHZvbHpxY2N5eWhldG1yZm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1NjY5MDAsImV4cCI6MjA4NTE0MjkwMH0.wAKIelaZ4n_amjrioJfkuU_MFPk6eKhSpBGFX-7TRnk'
)
