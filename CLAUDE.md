# Terminal Manutenção 3V3: notas para manutenção do código

- Site estático (GitHub Pages), sem build. Não introduzir bundler sem necessidade.
- Dados: Supabase. Toda regra de acesso mora no banco (RLS em `supabase/migrations`). O front só esconde botões; nunca confiar no front para segurança.
- Mudança de schema: criar um novo arquivo `supabase/migrations/000N_descricao.sql`, idempotente, e documentar no README. Não editar migrações já aplicadas em produção.
- Papéis (desde 0004): `admin` (gestor), `responsavel`, `auxiliar`, `diretoria`, `vendas`, `engenharia`, `painel` (TV do hall), `pendente` (conta nova). Tabela `profiles` com `celula` e `cargo`; função `meu_papel()`.
- Células: tabela `celulas` (SMD, USI, SER, INT, MONT, MAN, GES). Quem registra onde é `pode_registrar(celula)`: admin sempre; responsável na própria célula ou com `habilidades.nivel >= 2`; auxiliar só na célula da `escala` do dia (`hoje_local()`, fuso America/Fortaleza). Leitura: `pode_ver()` (sem vendas), `pode_ver_producao()` (com vendas), `interno()`.
- No front, `podeReg(cel)` em app.js espelha `pode_registrar` só para esconder botões; `aplicarPermissoes()` liga as classes do body (`ro` = não registra na MAN, `can-con`, `can-mat`, `prod-w`, `sem-man`, `kiosk`). Tela inicial por papel e célula em `landing()`.
- Célula de cada posto: `prod_roteiros.celula`; P1 a P7 = MONT; P8 = INT para produtos robustos (`celula_padrao()` no banco, `celulaPadrao()` em producao.js), editável na aba EQUIPE.
- NC de auxiliar nasce `Pendente` (sem placa); `confirmar_nc()` cria a placa. `prod_nc` não aceita insert direto: só por `abrir_nc()`.
- Painel do hall: `painel_hall()` devolve só agregados; a conta `painel` não lê nenhuma tabela.
- Diário: `placa_id` nulo = atividade GERAL. O status da placa é derivado do registro mais recente do diário (data, depois `criado_em`).
- Estado em memória: `S` (dados) e `UI` (tela) em `assets/app.js`. Cada tabela é recarregada inteira quando chega um evento do Realtime (`queueReload`).
- Textos da interface em português do Brasil, sem travessão.
- Nunca colocar a chave secreta do Supabase no repositório; só a publishable/anon em `config.js`.
- Produção: `assets/producao.js` (exporta `window.PROD`). Estado de cada unidade é derivado dos `prod_eventos` (última passagem por posto) e de `prod_nc`. Reprovação chama a função `abrir_nc` (security definer), que cria a NC e a placa da manutenção numa transação.
- Janela de carga (`JANELA_DIAS` em app.js, `[coluna, dias]`): unidades e eventos 240 dias, escala 60, apontamentos 180.
