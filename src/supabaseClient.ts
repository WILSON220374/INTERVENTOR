import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://fvgmkahfpibqzvlezlww.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2Z21rYWhmcGlicXp2bGV6bHd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MjI1OTgsImV4cCI6MjA5MjI5ODU5OH0.XXqq8uKYMoqS7boCbqffED_vWSijxU3hby-eVro9psk'
);