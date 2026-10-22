# Terminal Manutenção 3V3

Sistema web da manutenção de placas eletrônicas da 3V3 Tecnologia: cadastro de placas, diário de bordo, ficha com histórico, materiais, base de conhecimento, painel e relatório quinzenal. Visual de terminal, vários usuários ao mesmo tempo, dados no Supabase.

- **Front-end:** HTML, CSS e JavaScript puros (sem build). Publicado pelo GitHub Pages.
- **Banco e login:** Supabase (Postgres + Auth + Realtime).
- **Segurança:** as regras de acesso ficam no banco (Row Level Security). O site só usa a chave pública.
- **Catálogo:** os 152 itens da planilha oficial *3V3 Tecnologia LTDA - Produtos 2026.1* (fabricação própria e revenda), com linha, subgrupo, versão de PCB, firmware e fabricante. O admin pode editar em `[8] CONFIG` e voltar ao oficial com *restaurar catálogo oficial 2026.1*.

## Perfis

| Papel | O que pode |
|---|---|
| **Admin** | Tudo. Configura o catálogo, gerencia usuários, apaga placas e exemplos. |
| **Técnico** | Cadastra placas, registra o diário, pede materiais, registra conhecimento, escreve o relatório. Edita e apaga só os próprios registros. |
| **Leitura** | Vê painel, placas, fichas, relatório e evolução. Não registra nada. |

O **primeiro usuário** criado no Supabase vira Admin automaticamente. Os seguintes entram como Leitura até o Admin mudar o papel (aba `[8] CONFIG > Usuários`).

## Instalação (uma vez, cerca de 10 minutos)

### 1. Banco de dados

1. Abra o projeto no Supabase: `https://supabase.com/dashboard/project/cebievbbiyxzmkjpjgse`.
2. Vá em **SQL Editor > New query** e rode, nesta ordem, o conteúdo de cada arquivo (cole e clique em **Run**):
   1. [`supabase/migrations/0001_inicial.sql`](supabase/migrations/0001_inicial.sql): tabelas, perfis, regras de acesso e tempo real.
   2. [`supabase/migrations/0002_firmware.sql`](supabase/migrations/0002_firmware.sql): campo de versão de firmware na placa.
   3. Opcional: [`supabase/seeds/pendencias_produtos_2026_1.sql`](supabase/seeds/pendencias_produtos_2026_1.sql): as 34 pendências por produto da planilha Produtos 2026.1 entram na base de Conhecimento.

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

1. Supabase > **Authentication > Users > Invite user** com o seu e-mail. Você vira Admin.
2. Abra o link do e-mail, defina a senha e entre.
3. Em `[8] CONFIG`, preencha o responsável pelo setor e, se quiser treinar a equipe, carregue os dados de exemplo (IDs `EX-01` a `EX-12`, apagáveis com um clique).

### 6. Convidar a equipe

1. Supabase > **Authentication > Users > Invite user** com o e-mail de cada pessoa.
2. A pessoa define a senha pelo link e entra como **Leitura**.
3. Em `[8] CONFIG > Usuários`, mude o papel para **técnico** (ou admin) e clique em salvar.
4. Para tirar o acesso de alguém, desmarque **Ativo**.

## Uso no dia a dia

- **Chegou placa:** `[2] PLACAS`, cadastre. O banco gera o ID (`MP-0001`, `MP-0002`...). Escreva o ID na placa.
- **Trabalhou:** `[3] DIÁRIO`, uma linha por sessão. O status da placa vem do registro mais recente.
- **Fechou o diagnóstico:** abra a ficha e marque defeito e causa.
- **Trabalho sem placa** (bancada, POP, treinamento): placa `GERAL`.
- **Relatório quinzenal:** `[6] RELATÓRIO`, escolha a quinzena, escreva os dois textos e use *Copiar como texto*.
- **Backup:** `[8] CONFIG > Exportar`, um CSV por tabela. Faça a cada quinzena.

Atalhos (fora de campos de texto): `1` a `8` trocam de aba, `N` abre um novo registro no diário, `Ctrl+Enter` salva o formulário.

## Estrutura

```
index.html                      telas (HTML)
assets/style.css                visual de terminal (tema claro e escuro)
assets/app.js                   lógica, cálculos do relatório e acesso ao Supabase
config.js                       URL e chave pública do Supabase
supabase/migrations/            schema, regras de acesso e tempo real (rodar em ordem)
supabase/seeds/                 dados iniciais opcionais (pendências 2026.1)
```

## Rodar localmente

Qualquer servidor estático serve, por exemplo `python3 -m http.server 8080` na pasta do projeto, e abra `http://localhost:8080`. Para o login funcionar localmente, adicione `http://localhost:8080/**` em **Redirect URLs** no Supabase.
