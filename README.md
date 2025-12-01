# MPFit

Aplicação web para gerenciamento de treinos e dias (frontend Next.js + Neon/Postgres). Este README traz instruções rápidas para desenvolver e levantar o projeto localmente, além de observações de implantação.

**Resumo**
- Tech: Next.js (pages), React, SweetAlert2 para modais, Postgres (Neon) via `pg`.
- Local: projeto desenvolvido em `e:/Projetos/MPFit`.

**Pré-requisitos**
- Node.js (>=16) e npm/yarn
- Conta/instância Postgres (por exemplo Neon) e uma `DATABASE_URL`

**Variáveis de ambiente importantes**
- `DATABASE_URL` — URL de conexão com o Postgres/Neon (requer SSL na Neon).
- `PORT` — porta para rodar o dev server (opcional, padrão 3000).

Exemplo (PowerShell):
```powershell
Set-Location -Path 'E:\Projetos\MPFit'
$env:DATABASE_URL = 'postgresql://USER:PASS@host:5432/dbname?sslmode=require'
$env:PORT=3002; npm run dev
```

**Scripts úteis**
- `npm run dev` — inicia o Next.js em modo desenvolvimento.
- `npm run build` / `npm start` — build e start (produção).

Se o projeto usar algum script de importação local (ex.: `scripts/import_data.js`), rode-o com a `DATABASE_URL` apontando para o banco de desenvolvimento:
```powershell
$env:DATABASE_URL = 'postgresql://...'
node scripts/import_data.js
```

**Banco de dados / migrações**
- `lib/db.js` contém a inicialização do pool e funções que criam tabelas (CREATE TABLE IF NOT EXISTS) e aplica `ALTER TABLE IF NOT EXISTS` para campos como `user_id` quando necessário.
- Observação: alterações automáticas executadas via `initPg()` precisam ser aplicadas no ambiente de produção (ou rodadas manualmente no Neon) durante a primeira implantação para evitar erros 500 por colunas faltantes.

**Autenticação**
- A app usa JWT via cookie httpOnly (helper `lib/auth.js`). Rotas de API que exigem usuário usam `requireAuth`.

**Front-end: pontos de atenção**
- `pages/app.js` contém a UI principal (lista de dias, workouts, off-canvas menu). Muitos estilos e componentes rápidos (DayIcon, DayItem, AddDayTile) estão neste arquivo.
- Os modais utilizam SweetAlert2; há classes CSS `compact-swal` para modais responsivos em mobile.

**Problemas comuns & soluções**
- Erro 500 em produção relacionado a `user_id`: rode o `initPg` ou aplique manualmente os `ALTER TABLE` no banco.
- Se o dev server não levantar por causa de porta ocupada: exporte `PORT` e rode em outra porta.

**Contribuindo**
- Faça um fork/branch, abra PRs pequenos e específicos. Mantenha consistência com o estilo do projeto.

**Arquivos importantes**
- `pages/app.js` — UI principal (dias/exercícios)
- `lib/db.js` — abstração do banco / init
- `pages/api/*` — endpoints da API
- `scripts/import_data.js` — importador de dados de exemplo (quando presente)

Se quiser, eu posso:
- adicionar instruções de deploy (Vercel/Neon) específicas,
- gerar um arquivo `env.example` com variáveis necessárias,
- ou converter os modais SweetAlert2 para componentes React customizados para testes.

---
README gerado automaticamente — atualize conforme decisões de deploy/infra.
