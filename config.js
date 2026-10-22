// Configuração pública do Supabase.
// A chave "publishable" (ou "anon") pode ficar no site: quem protege os dados são as regras RLS do banco.
// NUNCA coloque aqui a chave secreta (service_role / sb_secret_...).
window.APP_CONFIG = {
  SUPABASE_URL: "https://cebievbbiyxzmkjpjgse.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlYmlldmJiaXl4em1ranBqZ3NlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2NzM3NjYsImV4cCI6MjEwODI0OTc2Nn0.f0UgRL9rTGPDMX2LdTuo0k-CtEOH8OiSEAUvaF45vX0" // Supabase > Project Settings > API Keys > Publishable key (ou anon key)
};
