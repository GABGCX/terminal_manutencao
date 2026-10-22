# Terminal 3V3 (produção e manutenção)

Sistema web da linha de eletrônica da 3V3 Tecnologia, com duas áreas:

- **Produção** (tecla `P`): ordens de produção com pedido e cliente, células com fila própria (SMD, usinagem, serralheria, integração, montagem), posto de trabalho com checklist do roteiro e cronômetro, rastreio por série, não conformidades da linha, tempos medidos, equipe (escala do dia e habilidades) e painel do hall para a TV.
- **Manutenção** (tecla `M`): cadastro de placas, diário de bordo, ficha com histórico, materiais, base de conhecimento, painel e relatório quinzenal.

Uma reprovação no posto abre a NC e cria a placa na manutenção sozinha. Quando a manutenção encerra a placa como reparada, o posto recebe a unidade de volta e ela volta para a fila do posto que reprovou. Visual de terminal, vários usuários ao mesmo tempo, dados no Supabase.

- **Front-end:** HTML, CSS e JavaScript puros (sem build). Publicado pelo GitHub Pages.
- **Banco e login:** Supabase (Postgres + Auth + Realtime).
- **Segurança:** as regras de acesso ficam no banco (Row Level Security). O site só usa a chave pública.
- **Catálogo:** os 152 itens da planilha oficial *3V3 Tecnologia LTDA - Produtos 2026.1* (fabricação própria e revenda), com linha, subgrupo, versão de PCB, firmware e fabricante. O admin pode editar em `[8] CONFIG` e voltar ao oficial com *restaurar catálogo oficial 2026.1*.

## Células e perfis

O setor é dividido em células. Cada pessoa tem um **papel** (o que pode fazer) e uma **célula principal** (onde trabalha e em que tela começa).

| Célula | O que faz | Responsável |
|---|---|---|
| `SMD` | Montagem SMD e eletrônica, lotes de placas | Roberto |
| `USI` | Usinagem, router CNC, laser, tornos, protótipos | Anderson |
| `SER` | Corte, solda, estruturas | Isaías |
| `INT` | Integração robusta: FIR, DIR Nutri e Dual Nutri, ECO PRO Nutri e Dual Nutri, ECO PRO 30N, EMR, quadros e hidráulica (P8) | Bruno |
| `MONT` | Montagem final, testes P1 a P7, integração leve no P8, separação e expedição | Helder |
| `MAN` | Manutenção de placas | Wendel |
| `GES` | Gestão, qualidade e estoque | Gabriel |

| Papel | Quem | O que pode |
|---|---|---|
| **Gestor** (`admin`) | Gabriel | Tudo. Usuários, escala do dia, matriz de habilidades, célula do P8 por produto, catálogo, tempos padrão. |
| **Responsável** | Roberto, Anderson, Isaías, Bruno, Helder, Wendel | Registra na própria célula e em qualquer célula onde tiver habilidade 2 ou mais. Cria OP, lote SMD e OF. Confirma as NC registradas por auxiliares. |
| **Auxiliar** | Nathan, Darlan | Registra só na célula em que o gestor o escalou no dia. Uma reprovação dele vira NC **pendente**, que o responsável da célula confirma (aí a placa vai para a manutenção) ou descarta. |
| **Diretoria** | | Vê produção e manutenção. Não registra. |
| **Engenharia** | firmware | Vê tudo e registra na base de Conhecimento. |
| **Vendas** | | Vê painel e ordens com pedido e cliente. Não vê manutenção nem NC. |
| **Painel do hall** | conta da TV | Só o painel do hall: números agregados, sem nomes, clientes ou séries. |
| **Pendente** | conta nova | Nada, até o gestor definir o papel. |

As regras valem no banco (Row Level Security), não só na tela. Níveis da matriz de habilidades: 0 não faz, 1 em treinamento, 2 faz sozinho, 3 domina, 4 ensina.

O **primeiro usuário** criado no Supabase vira Gestor automaticamente. Os seguintes entram como Pendente até o Gestor definir papel e célula (aba `[M] > CONFIG > Usuários`).

## Instalação (uma vez, cerca de 10 minutos)

### 1. Banco de dados

1. Abra o projeto no Supabase: `https://supabase.com/dashboard/project/cebievbbiyxzmkjpjgse`.
2. Vá em **SQL Editor > New query** e rode, nesta ordem, o conteúdo de cada arquivo (cole e clique em **Run**):
   1. [`supabase/migrations/0001_inicial.sql`](supabase/migrations/0001_inicial.sql): tabelas, perfis, regras de acesso e tempo real.
   2. [`supabase/migrations/0002_firmware.sql`](supabase/migrations/0002_firmware.sql): campo de versão de firmware na placa.
   3. [`supabase/migrations/0003_producao.sql`](supabase/migrations/0003_producao.sql): área de produção, papel operador e a função que abre NC na manutenção.
   4. [`supabase/seeds/roteiros_producao.sql`](supabase/seeds/roteiros_producao.sql): os 364 passos de roteiro de 43 produtos (planilha da linha v3). Sem ele não dá para criar ordens.
   5. [`supabase/migrations/0004_celulas_perfis.sql`](supabase/migrations/0004_celulas_perfis.sql): células, novos papéis, escala do dia, habilidades, pedido e cliente na OP, lotes SMD, ordens de fabricação, apontamento de horas, NC pendente e painel do hall. Converte os papéis antigos: técnico vira responsável da `MAN`, operador vira responsável da `MONT`, leitura vira diretoria.
   6. Opcional: [`supabase/seeds/pendencias_produtos_2026_1.sql`](supabase/seeds/pendencias_produtos_2026_1.sql): as 34 pendências por produto da planilha Produtos 2026.1 entram na base de Conhecimento.

   Todos podem ser rodados de novo sem perder nem duplicar dados.

### 2. Login

1. **Authentication > Sign In / Providers > Email**: deixe o e-mail ligado.
2. Desligue **Allow new users to sign up**. Assim só entra quem for convidado.
3. **Authentication > URL Configuration**:
   - **Site URL:** `https://gabgcx.github.io/terminal_manutencao/`
   - **Redirect URLs:** adicione `https://gabgcx.github.io/terminal_manutencao/**`

### 3. Chave pública

1. **Project Settings > API Keys**: copie a **Publishable key** (ou a `anon` key, na aba de chaves legadas).
2. Cole em [`config.js`](config.js), no lugar de `COLE_AQUI_A_CHAVE_PUBLICA`, e faça commit.

> Nunca coloque a chave secreta (`service_role` ou `sb_secret_...`) no repositório.

### 4. Publicar o site

1. No GitHub: **Settings > Pages > Build and deployment > Source: Deploy from a branch**.
2. Branch `main`, pasta `/ (root)`, **Save**.
3. Em 1 a 2 minutos o site fica em `https://gabgcx.github.io/terminal_manutencao/`.

### 5. Primeiro acesso

1. Supabase > **Authentication > Users > Invite user** com o seu e-mail. Você vira Gestor.
2. Abra o link do e-mail, defina a senha e entre.
3. Em `[8] CONFIG`, preencha o responsável pelo setor e, se quiser treinar a equipe, carregue os dados de exemplo (IDs `EX-01` a `EX-12`, apagáveis com um clique).

### 6. Convidar a equipe

1. Supabase > **Authentication > Users > Invite user** com o e-mail de cada pessoa.
2. A pessoa define a senha pelo link e entra como **Pendente** (vê só um aviso).
3. Em `[M] > [8] CONFIG > Usuários`, defina papel, célula principal e cargo, e clique em salvar.
4. Em `[P] > [8] EQUIPE`, preencha a matriz de habilidades e, a cada dia, a escala dos auxiliares.
5. Para a TV do hall: convide um e-mail só para ela e dê o papel **painel do hall**. Ela abre direto no painel e atualiza sozinha a cada minuto.
6. Para tirar o acesso de alguém, desmarque **Ativo**.

## Uso no dia a dia: produção

- **Começo do dia (gestor):** `[P] > [8] EQUIPE`, escolha a célula de cada auxiliar. Sem escala, o auxiliar só consulta.
- **Nova ordem:** `[P] > [2] ORDENS`, escolha o produto e a quantidade, com pedido e cliente. As séries são geradas (`OP-0001-001`...) ou coladas uma por linha. Na OP, *+ lote SMD* e *+ OF* abrem o pedido nas células já ligado à ordem.
- **Células:** `[P] > [3] CÉLULAS`. SMD abre e acompanha lotes (`LS-0001`: quantidade, OK, refugo). Usinagem e serralheria recebem ordens de fabricação (`OF-0001`: item, quantidade, feita). Integração e montagem mostram a fila dos postos. Em todas, *Apontar horas* registra produção, setup, retrabalho, desenvolvimento, espera de material, 5S e treinamento.
- **No posto:** `[P] > [4] POSTO`, escolha o posto da bancada (fica gravado no computador). O P8 tem duas filas: integração leve (MONT) e robusta (INT). Clique em *testar* ou leia a série, marque o checklist e aprove. Se falhar, *Reprovar*: modo de falha e descrição. Responsável abre a NC e a placa na manutenção na hora; auxiliar deixa a NC pendente.
- **NC pendente:** aparece em `[6] NC` e no posto com *confirmar e enviar à manutenção* ou *descartar* (a unidade volta para a fila).
- **Volta da manutenção:** quando a placa for encerrada como reparada, aparece no posto com *receber de volta*. Ela volta para a fila do posto que reprovou.
- **Tempos:** o cronômetro do posto mede cada passagem. Em `[7] TEMPOS` o gestor compara com o tempo padrão e, a partir de 5 medições, aplica a mediana ao roteiro.
- **Integração leve ou robusta:** `[8] EQUIPE > Integração no P8` troca a célula do P8 de um produto.
- **Meta do dia:** `[M] > [8] CONFIG`.

## Uso no dia a dia: manutenção

- **Chegou placa:** `[2] PLACAS`, cadastre. O banco gera o ID (`MP-0001`, `MP-0002`...). Escreva o ID na placa.
- **Trabalhou:** `[3] DIÁRIO`, uma linha por sessão. O status da placa vem do registro mais recente.
- **Fechou o diagnóstico:** abra a ficha e marque defeito e causa.
- **Trabalho sem placa** (bancada, POP, treinamento): placa `GERAL`.
- **Relatório quinzenal:** `[6] RELATÓRIO`, escolha a quinzena, escreva os dois textos e use *Copiar como texto*.
- **Backup:** `[8] CONFIG > Exportar`, um CSV por tabela. Faça a cada quinzena.

Atalhos (fora de campos de texto): `M` e `P` trocam de área, `1` a `8` trocam de aba, `N` abre um novo registro no diário, `Ctrl+Enter` salva o formulário.

## Estrutura

```
index.html                      telas (HTML)
assets/style.css                visual de terminal (tema claro e escuro)
assets/app.js                   manutenção, login, navegação e acesso ao Supabase
assets/producao.js              área de produção (ordens, células, posto, rastreio, NC, tempos, equipe, painel do hall)
config.js                       URL e chave pública do Supabase
supabase/migrations/            schema, regras de acesso e tempo real (rodar em ordem)
supabase/seeds/                 roteiros de produção e pendências 2026.1
```

## Rodar localmente

Qualquer servidor estático serve, por exemplo `python3 -m http.server 8080` na pasta do projeto, e abra `http://localhost:8080`. Para o login funcionar localmente, adicione `http://localhost:8080/**` em **Redirect URLs** no Supabase.
