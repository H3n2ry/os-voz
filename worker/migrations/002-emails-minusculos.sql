-- Migração 002 — e-mails em minúsculas
--
--   npx wrangler d1 execute os-voz-db --remote --file=./migrations/002-emails-minusculos.sql
--
-- A coluna email é UNIQUE e sensível a maiúsculas. Contas antigas foram gravadas
-- exatamente como digitadas ("Sppabx@gmail.com"), então quem cadastrou com
-- maiúscula precisava repetir a maiúscula para entrar. O login passou a
-- normalizar o e-mail — sem esta migração, essas contas ficariam inacessíveis.
--
-- Seguro rodar mais de uma vez.

UPDATE users
   SET email = lower(trim(email))
 WHERE email <> lower(trim(email));

-- Nomes gravados com espaço sobrando aparecem torto no cabeçalho da OS.
UPDATE users
   SET nome = trim(nome)
 WHERE nome <> trim(nome);
