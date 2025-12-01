<!-- prettier-ignore -->
# 🚀 MPFit — Gerenciador de Treinos

Bem-vindo ao MPFit — uma aplicação web leve para organizar seus dias de treino, exercícios e registros. Este README foi produzido para ser direto, moderno e visualmente prático: contém instruções de setup, arquitetura do projeto e dicas para desenvolvimento e deploy.

---

🎯 Principais tecnologias

- Frontend: Next.js (páginas) + React
- Banco: PostgreSQL (Neon recomendado)
- Modais: SweetAlert2
- DB Client: `pg` (node-postgres)

📁 Estrutura resumida

```
e:/Projetos/MPFit
├─ pages/
│  ├─ app.js            # UI principal: dias, workouts, off-canvas
│  ├─ dashboard.js     # Página de dashboard/estatísticas
│  └─ api/             # Endpoints (days, workouts, auth, dashboard...)
├─ lib/
│  └─ db.js            # Inicialização do pool e helpers SQL
├─ scripts/
│  └─ import_data.js   # Utilitário para importar dados de exemplo
├─ public/             # Imagens e assets estáticos
└─ README.md
```

---

⚙️ Pré-requisitos

- Node.js >= 16
- npm ou yarn
- Uma instância Postgres (Neon recomendado) e a `DATABASE_URL`

Exemplo (PowerShell):

```powershell
Set-Location -Path 'E:\Projetos\MPFit'
$env:DATABASE_URL = 'postgresql://USER:PASS@host:5432/dbname?sslmode=require'
$env:PORT=3002; npm run dev
```

---

🧭 Variáveis de ambiente

- `DATABASE_URL` — string de conexão com o Postgres/Neon (SSL quando usar Neon)
- `PORT` — porta para o dev server (padrão 3000)

Sugestão: crie um arquivo local `.env` (não comitar) ou use um `env.local` no Next.js para desenvolvimento.

---

📦 Scripts importantes

- `npm run dev` — roda o Next.js em modo desenvolvimento
- `npm run build` — cria build para produção
- `npm start` — inicia a build em produção

Se houver `scripts/import_data.js` use:

```powershell
$env:DATABASE_URL='postgresql://...'; node scripts/import_data.js
```

---

🗄️ Banco de dados e migrações

- `lib/db.js` contém a inicialização do pool e um `initPg()` que cria tabelas com `CREATE TABLE IF NOT EXISTS` e aplica `ALTER TABLE IF NOT EXISTS` para colunas como `user_id` e `share_code` quando necessário.
- Observação: embora `initPg()` proteja contra erros em ambientes novos, para produção é recomendável aplicar migrações explicitamente na pipeline (ou garantir que o processo de inicialização execute `initPg()` com permissões adequadas).

---

🔐 Autenticação

- A aplicação usa JWT armazenado em cookie httpOnly. O helper `lib/auth.js` expõe `requireAuth` para proteger rotas de API.

---

🧩 Arquitetura front-end

- `pages/app.js` — componente principal: listagem de dias, seleção, arrastar/exercícios, controles de iniciar/concluir treino e off-canvas menu.
- Componentes e utilitários principais:
	- `DayIcon`, `DayItem`, `AddDayTile` — itens visuais dos dias
	- Workouts: listagem com ações (editar/excluir/definir peso)
	- Modais: SweetAlert2, com classe `compact-swal` para versão mobile

---

🛠️ Boas práticas e problemas comuns

- Erro 500 por falta de `user_id`: execute `initPg()` ou rode os `ALTER TABLE` no banco de produção.
- Porta em uso (EADDRINUSE): exporte `PORT` e use outra porta (ex.: 3002).

---

🎨 Estilo e UX

- A UI usa classes utilitárias e um bloco de estilos globais em `pages/app.js`. Há atenção para mobile-first; estilos específicos para desktop são aplicados com media queries.

---

🚀 Deploy rápido (ex: Vercel + Neon)

1. Configure o projeto no Vercel apontando para o repositório.
2. Defina a variável de ambiente `DATABASE_URL` nas configurações do projeto no Vercel.
3. Garanta que `initPg()` ou migrações sejam executadas na primeira inicialização (ou aplique SQL manualmente no Neon).

---

📁 Mapa de arquivos (detalhado)

- `pages/app.js` — UI principal
- `pages/dashboard.js` — visão analítica (volume, semanas, últimos dias)
- `pages/api/days/*` — CRUD de days e endpoints relacionados (share/start/complete)
- `pages/api/workouts/*` — CRUD de workouts e endpoints auxiliar (current weight, reorder)
- `lib/db.js` — pool Postgres, helpers e `initPg()`
- `lib/auth.js` — autenticação JWT e helper `requireAuth`
- `scripts/import_data.js` — ferramenta de importação

---

🤝 Contribuição

- Abra issues para bugs e feature requests.
- Para PRs: faça branch com escopo pequeno, inclua descrições e screenshots quando fizer mudanças visuais.

---

🧾 Próximos passos que posso ajudar a automatizar

- Gerar `env.example` com variáveis essenciais
- Adicionar script de migração/seed (ex.: usando `node-pg-migrate` ou `umzug`)


© Projeto MPFit — documentação gerada automaticamente. Atualize conforme arquitetura e infra evoluírem.

---

## 🚢 Deploy detalhado — Vercel + Neon (Postgres)

Veja abaixo instruções passo-a-passo para publicar a aplicação no Vercel usando um banco Neon. Inclui comandos SQL para garantir que colunas necessárias (ex.: `user_id`, `share_code`) existam em produção.

### 1) Criar o banco no Neon

- Crie um projeto/database no Neon (https://neon.tech/) e gere a `DATABASE_URL` (connection string). Copie a URL — você vai precisar no Vercel.

### 2) Configurar o projeto no Vercel

1. Faça push do repositório no GitHub/GitLab/Bitbucket.
2. No Vercel, clique em **Import Project** → escolha o repositório.
3. Em **Environment Variables**, adicione `DATABASE_URL` com a connection string do Neon. Defina para **Production** (e para Preview/Development se desejar).
4. Build Command: `npm run build` (padrão)
5. Output Directory: deixe vazio (Next.js padrão)
6. Deploy.

> Observação: Não é obrigatório executar migrações no próprio Vercel — você pode aplicar os comandos SQL diretamente no Neon antes do deploy ou executar `initPg()` localmente apontando para a `DATABASE_URL` de produção.

### 3) SQL recomendados (executar no Neon SQL Editor ou via psql)

Execute os comandos abaixo caso o seu banco antigo não possua as colunas `user_id` e `share_code` (ajuste nomes conforme seu esquema se diferente). Esses `ALTER TABLE IF NOT EXISTS` adicionam colunas sem quebrar dados existentes.

SQL (cole no Neon SQL editor ou rode com `psql`):

```sql
-- adicionar user_id às tabelas principais
ALTER TABLE IF EXISTS days ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS workouts ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE IF EXISTS logs ADD COLUMN IF NOT EXISTS user_id uuid;

-- adicionar campo de compartilhamento se for usado
ALTER TABLE IF EXISTS days ADD COLUMN IF NOT EXISTS share_code text;

-- índices úteis
CREATE INDEX IF NOT EXISTS idx_days_user_id ON days(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_days_share_code ON days(share_code);
```

Exemplo de execução via `psql` (PowerShell):

```powershell

---
```

> Observação: ajuste `uuid` para o tipo que sua `users.id` utiliza (ex.: `uuid` ou `text`). Se desejar adicionar `FOREIGN KEY`, execute após garantir que a tabela `users` existe e que os valores são compatíveis.

### 4) Alternativa: rodar `initPg()` localmente apontando para o DB de produção

Se preferir, você pode executar a função `initPg()` embutida em `lib/db.js` a partir do seu ambiente local (com a `DATABASE_URL` apontando para o Neon de produção). Isso aplicará os CREATE/ALTER que o código já contém.

Com PowerShell, por exemplo:

```powershell
Set-Location -Path 'E:\Projetos\MPFit'
$env:DATABASE_URL = 'postgresql://...'
node -e "require('./lib/db').initPg().then(()=>console.log('initPg done')).catch(e=>{ console.error(e); process.exit(1); })"
```

Essa chamada irá executar os `CREATE TABLE IF NOT EXISTS` e `ALTER TABLE IF NOT EXISTS` conforme implementado em `lib/db.js`.

### 5) Variáveis de ambiente extras e dicas

- `NEXT_PUBLIC_SOME_VAR` — se precisar expor variáveis ao cliente, prefixe com `NEXT_PUBLIC_` e defina no Vercel.
- Se usar migrations formais no futuro, considere adicionar `node-pg-migrate` ou `knex` ao fluxo de CI e rodar as migrações na etapa de deploy.

### 6) Pós-deploy

- Acesse a URL gerada pelo Vercel e faça login/criação de conta para validar.
- Teste endpoints que usam `user_id` e operações de criação/compartilhamento de dias.

---

Se quiser, eu posso:
- gerar um script de migração `migrate.js` para executar esses `ALTER TABLE` de forma idempotente, ou
- fornecer comandos prontos para rodar no PowerShell/CI com `psql` e tratamento de erros. Qual prefere? 

README gerado automaticamente — atualize conforme decisões de deploy/infra.
