# Terminal Manutenção 3V3: notas para manutenção do código

- Site estático (GitHub Pages), sem build. Não introduzir bundler sem necessidade.
- Dados: Supabase. Toda regra de acesso mora no banco (RLS em `supabase/migrations`). O front só esconde botões; nunca confiar no front para segurança.
- Mudança de schema: criar um novo arquivo `supabase/migrations/000N_descricao.sql`, idempotente, e documentar no README. Não editar migrações já aplicadas em produção.
- Papéis: `admin`, `tecnico` (manutenção), `operador` (produção), `leitura` (tabela `profiles`, função `meu_papel()`).
- Diário: `placa_id` nulo = atividade GERAL. O status da placa é derivado do registro mais recente do diário (data, depois `criado_em`).
- Estado em memória: `S` (dados) e `UI` (tela) em `assets/app.js`. Cada tabela é recarregada inteira quando chega um evento do Realtime (`queueReload`).
- Textos da interface em português do Brasil, sem travessão.
- Nunca colocar a chave secreta do Supabase no repositório; só a publishable/anon em `config.js`.
- Produção: `assets/producao.js` (exporta `window.PROD`). Estado de cada unidade é derivado dos `prod_eventos` (última passagem por posto) e de `prod_nc`. Reprovação chama a função `abrir_nc` (security definer), que cria a NC e a placa da manutenção numa transação.
- Unidades e eventos de produção são carregados numa janela de 240 dias (`JANELA_DIAS` em app.js).
