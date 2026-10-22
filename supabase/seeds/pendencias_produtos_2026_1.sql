-- =====================================================================
-- Pendências por produto da planilha "3V3 Tecnologia LTDA - Produtos 2026.1" (aba Página3)
-- Entram na base de Conhecimento com status Registrado.
-- Rode uma vez no SQL Editor. Rodar de novo não duplica.
-- =====================================================================
insert into public.conhecimento (data, tipo, titulo, produto, resp, descricao, status, criado_por)
select date '2026-10-22', v.tipo, v.titulo, v.produto, v.resp,
       'Pendência registrada na planilha Produtos 2026.1 (Página3).', 'Registrado', null
from (values
  ('Descoberta técnica', 'Verificar placa Meripobo que não lê bateria', 'DIR Solar', null),
  ('Procedimento padronizável', 'CCPS - Teste Jiga', 'DIR Solar', null),
  ('Descoberta técnica', 'Tensão de corte da bateria (12.1V)', 'DIR Solar', null),
  ('Oportunidade de melhoria', 'Melhorar os testes - verificar rádio', 'DIR Solar', null),
  ('Oportunidade de melhoria', 'Melhorar os testes do rádio', 'DIR Solar', 'Régis'),
  ('Oportunidade de melhoria', 'Colocar um Rep na sogra do Michel', 'DIR Solar', null),
  ('Procedimento padronizável', 'POP de gravação do cartão/configuração', 'CIR', null),
  ('Oportunidade de melhoria', 'Problemas Teste interno', 'CIR', null),
  ('Oportunidade de melhoria', 'Hora da montagem', 'CIR', null),
  ('Procedimento padronizável', 'Modificar o POP e criar jigas', 'CIR', null),
  ('Oportunidade de melhoria', 'Cabo flat', 'CIR', null),
  ('Oportunidade de melhoria', 'Safe Shutdown', 'CIR', 'Régis'),
  ('Procedimento padronizável', 'Teste interno placa', 'EMR', null),
  ('Oportunidade de melhoria', 'Melhorar placa - CCPS integrado', 'EMR', null),
  ('Oportunidade de melhoria', 'Matar sensor barométrico', 'EMR', null),
  ('Dependência de outro setor', 'APP comunicar com rádio novo', 'EMR', 'Régis'),
  ('Oportunidade de melhoria', 'Substituir PLC do REP pelo DIR Solar', 'REP', null),
  ('Procedimento padronizável', 'Fazer os arquivos da Pick & Place', 'REP', null),
  ('Procedimento padronizável', 'Não há POP', 'Linha ECO', null),
  ('Descoberta técnica', 'Pi zero - arriscado', 'Linha ECO', null),
  ('Oportunidade de melhoria', 'Melhorar os testes internos das placas', 'FIR', null),
  ('Defeito recorrente', 'Muito retrabalho', 'FIR', null),
  ('Procedimento padronizável', 'Documentar antena', 'Antena 3v3 INOX - Omni-Direcional', null),
  ('Procedimento padronizável', 'Documentar testes', 'Antena 3v3 INOX - Omni-Direcional', null),
  ('Procedimento padronizável', 'POP', 'Antena 3v3 INOX - Omni-Direcional', null),
  ('Descoberta técnica', 'Antena parece frágil - suporte', 'Antena 3v3 INOX - Omni-Direcional', null),
  ('Dependência de outro setor', 'Sem retorno dos clientes', 'STD-M', null),
  ('Defeito recorrente', 'Borrais em campo', 'SCE-A / SCE-R', null),
  ('Procedimento padronizável', 'Manual', 'SCE-A / SCE-R', null),
  ('Procedimento padronizável', 'Falta documentação', 'SMF', null),
  ('Procedimento padronizável', 'Falta documentação', 'SPD-AP / SPD-BP', null),
  ('Procedimento padronizável', 'Falta documentação', 'STU-AS', null),
  ('Oportunidade de melhoria', 'Falta teste externo na Mata Fresca', 'Inversor IF30', null),
  ('Oportunidade de melhoria', 'Validar no cliente', '2F12V', null)
) as v(tipo, titulo, produto, resp)
where not exists (
  select 1 from public.conhecimento c where c.titulo = v.titulo and c.produto = v.produto
);
