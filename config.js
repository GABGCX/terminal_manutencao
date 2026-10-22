// Configuração pública do Supabase.
// A chave "publishable" (ou "anon") pode ficar no site: quem protege os dados são as regras RLS do banco.
// NUNCA coloque aqui a chave secreta (service_role / sb_secret_...).
window.APP_CONFIG = {
  SUPABASE_URL: "https://cebievbbiyxzmkjpjgse.supabase.co",
  SUPABASE_ANON_KEY: "COLE_AQUI_A_CHAVE_PUBLICA" // Supabase > Project Settings > API Keys > Publishable key (ou anon key)
};
