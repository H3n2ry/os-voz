-- Schema do banco D1 (os-voz-db)
-- Aplicar com:
--   npx wrangler d1 execute os-voz-db --remote --file=./schema.sql
-- (use --local para o banco de desenvolvimento)

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  nome          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  funcao        TEXT,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS ordens_servico (
  id                   TEXT PRIMARY KEY,
  numero_os            INTEGER NOT NULL,
  tecnico_id           TEXT NOT NULL,
  tecnico_nome         TEXT,
  cliente              TEXT,
  endereco             TEXT,
  tipo_servico         TEXT,
  descricao_servico    TEXT,
  materiais_utilizados TEXT,            -- JSON serializado
  observacoes          TEXT,
  valores              TEXT,            -- JSON { campo_key: valor } usado para sobrepor no molde
  status               TEXT NOT NULL DEFAULT 'gerada',  -- gerada | aprovada | cancelada
  pdf_url              TEXT,
  esboco_foto_url      TEXT,
  cabecalho            TEXT,            -- JSON do cabecalho vigente quando a OS foi criada
  audio_transcricao    TEXT,
  created_at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_os_tecnico ON ordens_servico (tecnico_id);
CREATE INDEX IF NOT EXISTS idx_os_status  ON ordens_servico (status);

-- contador de número sequencial da OS
CREATE TABLE IF NOT EXISTS os_sequence (
  id  INTEGER PRIMARY KEY,
  seq INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO os_sequence (id, seq) VALUES (1, 0);

-- molde base do técnico (1 por usuário): imagem de fundo + mapa de campos
CREATE TABLE IF NOT EXISTS moldes (
  user_id    TEXT PRIMARY KEY,
  bg_image   TEXT NOT NULL,            -- JPEG em base64 (sem prefixo data:)
  img_w      INTEGER NOT NULL,
  img_h      INTEGER NOT NULL,
  campos     TEXT NOT NULL,            -- JSON [{ key, label, x, y, w, size, multiline }] (coords normalizadas 0..1)
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
