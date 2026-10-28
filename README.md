# OS por Voz

Web app PWA para geração de Ordens de Serviço por voz, voltado a equipes de campo.
O técnico grava um áudio descrevendo o serviço; a IA formaliza o relato, monta a
Ordem de Serviço num layout profissional pronto e gera o PDF. O cabeçalho (logo e
dados da empresa) é configurado uma vez e entra em toda OS emitida.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite + Tailwind CSS (PWA) |
| Backend / API | Cloudflare Worker |
| Banco de dados | Cloudflare D1 (SQLite) |
| Auth | JWT próprio no Worker (PBKDF2 + HMAC SHA-256, Web Crypto API) |
| Transcrição | Groq — `whisper-large-v3-turbo` (resolvido em runtime) |
| Geração da OS | Groq — `openai/gpt-oss-120b` (resolvido em runtime) |
| Hospedagem frontend | Vercel |
| PDF | `@react-pdf/renderer` (gerado no browser) |

> **Nota:** a pasta `supabase/` é uma implementação **legada** (Edge Functions + Anthropic)
> e **não é usada** pelo frontend atual. O backend ativo é o Cloudflare Worker em `worker/`.

---

## Arquitetura

```
Browser (React PWA, Vercel)
        │  fetch  (VITE_API_URL)
        ▼
Cloudflare Worker  (worker/src/index.js)
        ├── D1 (os-voz-db)          ← usuários e ordens de serviço
        └── Groq API                ← Whisper (transcrição) + gpt-oss (geração)
```

---

## Setup — passo a passo

### 1. Clonar e instalar

```bash
git clone <repo-url>
cd os-voz
npm install
cd worker && npm install && cd ..
```

### 2. Criar o banco D1

```bash
cd worker
npx wrangler login
npx wrangler d1 create os-voz-db
```

Copie o `database_id` retornado para o `worker/wrangler.toml` (campo `database_id`).

Crie as tabelas (execute o schema abaixo):

```bash
npx wrangler d1 execute os-voz-db --remote --file=./schema.sql
```

> O Worker espera as tabelas `users`, `ordens_servico`, `os_sequence` e `moldes`.
> Banco já existente: rode também as [migrações](#migrações).

### 3. Secrets do Worker

Para **produção** (Cloudflare):

```bash
cd worker
npx wrangler secret put GROQ_API_KEY     # gsk_...
npx wrangler secret put JWT_SECRET       # string longa e aleatória (mín. 32 chars)
```

Para **desenvolvimento local**, copie o exemplo e preencha:

```bash
cp worker/.dev.vars.example worker/.dev.vars
```

```
GROQ_API_KEY=gsk_...
JWT_SECRET=uma_string_longa_e_aleatoria_minimo_32_chars
```

### 4. Variáveis de ambiente do frontend

```bash
cp .env.example .env
```

```
# dev (wrangler dev local)
VITE_API_URL=http://localhost:8787
# produção (após deploy do worker)
# VITE_API_URL=https://os-voz-api.SEU_USUARIO.workers.dev
```

### 5. Rodar em desenvolvimento

Em dois terminais:

```bash
# terminal 1 — Worker (API + D1 local)
cd worker
npx wrangler dev          # http://localhost:8787

# terminal 2 — frontend
npm run dev               # http://localhost:5173
```

### 6. Deploy

**Worker (Cloudflare):**

```bash
cd worker
npx wrangler deploy
```

**Frontend (Vercel):**

```bash
npm install -g vercel
vercel
```

Na dashboard da Vercel, configure a env var:
- `VITE_API_URL` → URL do Worker em produção

---

## Schema do banco

O schema completo vive em [`worker/schema.sql`](worker/schema.sql) — quatro tabelas:
`users`, `ordens_servico`, `os_sequence` (contador do número da OS) e `moldes`
(cabeçalho da empresa, um por técnico).

```bash
cd worker && npx wrangler d1 execute os-voz-db --remote --file=./schema.sql
```

### Migrações

Bancos criados antes de uma mudança de schema precisam das migrações em
[`worker/migrations/`](worker/migrations), aplicadas em ordem e **uma única vez**:

```bash
cd worker && npx wrangler d1 execute os-voz-db --remote --file=./migrations/001-utc-e-cabecalho.sql
```

> A migração 001 é **pré-requisito** do deploy correspondente do Worker: ela cria a
> coluna `cabecalho`, que o `POST /os` passou a gravar. Rodar o deploy antes dela
> faz o salvamento de OS falhar.

**Carimbos de tempo:** tudo é gravado em ISO-8601 UTC explícito
(`2026-08-20T11:52:33Z`). O formato antigo do `datetime('now')` —
`2026-08-20 11:52:33` — é UTC mas não diz, e o navegador lia como hora local:
o horário aparecia 3h adiantado e o filtro por data errava o dia em registros
do fim da noite. A migração 001 converte os registros antigos.

---

## API do Worker

| Método | Rota | Auth | Descrição |
|---|---|---|---|
| POST | `/auth/register` | — | Cadastro (`email`, `senha`, `nome`) |
| POST | `/auth/login` | — | Login → retorna JWT (90 dias) |
| GET  | `/auth/me` | JWT | Dados do usuário logado |
| GET  | `/os` | JWT | Lista as OS do técnico logado |
| POST | `/os` | JWT | Cria/salva uma OS |
| GET  | `/os/admin` | JWT (admin) | Lista todas as OS |
| PATCH| `/os/:id/status` | JWT (admin) | Atualiza status (`gerada`/`aprovada`/`cancelada`) |
| GET  | `/os/proximo-numero` | JWT | Espia o próximo nº sequencial (prévia) |
| GET  | `/molde` | JWT | Cabeçalho da empresa do técnico |
| PUT  | `/molde` | JWT | Salva o cabeçalho |
| DELETE | `/molde` | JWT | Remove o cabeçalho |
| POST | `/transcribe` | JWT | Áudio (multipart) → transcrição (Groq Whisper) |
| POST | `/gerar-os` | JWT | Relato + campos → JSON da OS (Groq LLM) |
| GET  | `/health/models` | — | Diagnóstico dos modelos de IA (200 = ok, 503 = usando reserva) |

---

## Modelos de IA — proteção contra descontinuação

Provedores desligam modelos em data marcada. A Groq desligou o
`llama-3.3-70b-versatile` em **16/08/2026** e o `/gerar-os` parou de funcionar
de um dia para o outro. Para que isso não volte a acontecer, o nome do modelo
deixou de ser uma constante no meio do código: ele é resolvido em tempo de
execução por [`worker/src/groq.js`](worker/src/groq.js), com cinco camadas.

| # | Camada | O que faz |
|---|---|---|
| 1 | Override por env var | `GROQ_CHAT_MODEL` / `GROQ_TRANSCRIBE_MODEL` no `wrangler.toml` fixam o modelo na marra. Conserto em 1 minuto, sem mexer no código. |
| 2 | Lista de preferência | `PREFERIDOS` em `groq.js` — ordem explícita de quem assume. Produção no topo, preview no fim. |
| 3 | Descoberta dinâmica | `GET /v1/models` diz o que a conta tem **agora**; o que não estiver na lista é descartado. |
| 4 | Retry automático | Um `400 model_decommissioned` marca o modelo como morto, relê a lista e refaz a chamada com o próximo — dentro da mesma requisição. O técnico em campo não vê erro. |
| 5 | Aviso preventivo | Cron semanal + `/health/models` avisam quando um preferido sai do ar, antes de virar chamado. |

Se **todos** os preferidos forem desligados de uma vez, a camada 3 adota
qualquer modelo compatível que a conta ainda tenha. O app não fica fora do ar
esperando deploy.

```bash
# Cenários de falha cobertos por teste (não chama a API real):
cd worker && npm test
```

**Checar em produção:**

```bash
curl -s https://os-voz-api.SEU_USUARIO.workers.dev/health/models
```

Resposta com `"ok": true` = rodando no modelo ideal. `"usando_reserva": true` =
funcionando, mas hora de revisar a lista em `groq.js` contra
[console.groq.com/docs/deprecations](https://console.groq.com/docs/deprecations).

**Em emergência** (quer trocar de modelo agora, sem discussão):

```bash
cd worker
# edite GROQ_CHAT_MODEL no wrangler.toml e:
npx wrangler deploy
```

---

## Criar um administrador

Após criar a conta pelo app, promova o usuário a admin via D1:

```bash
cd worker
npx wrangler d1 execute os-voz-db --remote \
  --command "UPDATE users SET is_admin = 1 WHERE email = 'usuario@exemplo.com';"
```

---

## Ícones PWA

Já presentes em `public/icons/` — substitua pelos da sua marca se quiser:
- `icon-192.png` (192 × 192 px)
- `icon-512.png` (512 × 512 px)

---

## Fluxo de uso

```
Técnico → Nova OS
  ├─ Grava áudio (ou escreve) → transcrição automática (Groq Whisper)
  ├─ A IA formaliza o relato e preenche os campos da OS
  ├─ Confere o preview e corrige o que quiser
  └─ Salvar OS → PDF gerado no browser + registro no D1

Gestor → /admin
  ├─ Vê todas as OS de todos os técnicos
  ├─ Aprova / Cancela OS
  └─ Exporta CSV filtrado
```

---

## Estrutura de arquivos

```
os-voz/
├── public/icons/
├── src/
│   ├── components/
│   │   ├── AudioRecorder.jsx
│   │   ├── Layout.jsx        ← navegação + tour de onboarding
│   │   ├── OSCard.jsx
│   │   ├── OSPreview.jsx
│   │   └── TourGuide.jsx
│   ├── hooks/
│   │   ├── useAuth.jsx
│   │   └── useAudioRecorder.js
│   ├── lib/
│   │   ├── api.js            ← cliente HTTP (aponta para VITE_API_URL)
│   │   ├── datas.js          ← lê os carimbos UTC do banco no fuso do usuário
│   │   ├── datas.test.mjs    ← npm test
│   │   ├── imagePrep.js      ← reduz a logo para JPEG base64
│   │   ├── osFields.js       ← campos padrão da OS
│   │   └── pdfGenerator.jsx  ← gera o PDF da OS no browser
│   └── pages/
│       ├── Login.jsx
│       ├── NovaOS.jsx
│       ├── ConfigurarMolde.jsx  ← cabeçalho da empresa
│       ├── Historico.jsx
│       └── Admin.jsx
└── worker/                   ← BACKEND ATIVO
    ├── src/index.js          ← API + auth + rotas
    ├── src/groq.js           ← resolução de modelo + fallback
    ├── test/fallback.test.mjs ← npm test
    ├── migrations/           ← alterações de schema, aplicar em ordem
    ├── schema.sql
    └── wrangler.toml         ← binding D1: os-voz-db
```
