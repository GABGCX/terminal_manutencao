-- =====================================================================
-- 0002 · versão de firmware no cadastro da placa
-- Rode depois do 0001. Idempotente.
-- =====================================================================
alter table public.placas add column if not exists firmware text;
comment on column public.placas.versao   is 'Versão da placa (PCB), ex.: DIR V5.1, ECO v2.1';
comment on column public.placas.firmware is 'Versão do firmware encontrada na placa, ex.: D011, CCPS_V5';
