import { createClient } from '@supabase/supabase-js'

// Using main Tonal Chaos Database Supabase (Pro plan)
// All playlist tables are prefixed with 'pd_' to avoid conflicts
export const supabase = createClient(
  'https://guzthooxrcuomkdjzmvy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1enRob294cmN1b21rZGp6bXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5NDU4NjEsImV4cCI6MjA4MjUyMTg2MX0.cGt_3K3C7jP2bKI12RhO3CJSURSZtx9ZcoZRaLELyRw'
)
