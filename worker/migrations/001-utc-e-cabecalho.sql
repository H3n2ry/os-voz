-- Migração 001 — carimbos em UTC explícito + cabeçalho congelado na OS
--
-- Aplicar uma única vez:
--   npx wrangler d1 execute os-voz-db --remote --file=./migrations/001-utc-e-cabecalho.sql
--
-- Contexto: os carimbos eram gravados por datetime('now'), que produz
-- "2026-08-20 11:52:33" — UTC, mas sem dizer que é UTC. O navegador lia essa
-- string como hora LOCAL, exibindo o horário 3h adiantado no fuso de Brasília
-- e fazendo o filtro por data errar o dia em registros do fim da noite.
-- A partir daqui tudo é gravado como "2026-08-20T11:52:33Z".

-- Guarda o cabeçalho (logo + dados da empresa) vigente no momento da criação,
-- para o PDF do painel do gestor sair com timbre e para OS antigas não mudarem
-- de aparência quando o técnico troca a logo.
ALTER TABLE ordens_servico ADD COLUMN cabecalho TEXT;

-- Converte os registros já existentes para ISO-8601 com Z.
UPDATE ordens_servico
   SET created_at = replace(created_at, ' ', 'T') || 'Z'
 WHERE created_at IS NOT NULL AND created_at NOT LIKE '%Z';

UPDATE users
   SET created_at = replace(created_at, ' ', 'T') || 'Z'
 WHERE created_at IS NOT NULL AND created_at NOT LIKE '%Z';

UPDATE moldes
   SET created_at = replace(created_at, ' ', 'T') || 'Z'
 WHERE created_at IS NOT NULL AND created_at NOT LIKE '%Z';

UPDATE moldes
   SET updated_at = replace(updated_at, ' ', 'T') || 'Z'
 WHERE updated_at IS NOT NULL AND updated_at NOT LIKE '%Z';
