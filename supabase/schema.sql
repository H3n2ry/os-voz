-- ============================================================
-- OS por Voz — Schema Supabase
-- Execute no SQL Editor do painel Supabase
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- Perfis de usuários (espelho de auth.users)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id        UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome      TEXT NOT NULL,
  funcao    TEXT NOT NULL DEFAULT 'tecnico',
  is_admin  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- Ordens de Serviço
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id                   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero_os            SERIAL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tecnico_id           UUID REFERENCES auth.users(id) NOT NULL,
  tecnico_nome         TEXT NOT NULL,
  cliente              TEXT NOT NULL,
  endereco             TEXT NOT NULL,
  tipo_servico         TEXT NOT NULL,
  descricao_servico    TEXT NOT NULL,
  materiais_utilizados JSONB NOT NULL DEFAULT '[]',
  observacoes          TEXT,
  status               TEXT NOT NULL DEFAULT 'gerada'
                         CHECK (status IN ('gerada', 'aprovada', 'cancelada')),
  pdf_url              TEXT,
  esboco_foto_url      TEXT,
  audio_transcricao    TEXT NOT NULL
);

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;

-- Profiles: cada usuário lê/atualiza o próprio perfil
CREATE POLICY "usuario_le_proprio_perfil" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "usuario_atualiza_proprio_perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins enxergam todos os perfis
CREATE POLICY "admin_le_todos_perfis" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- OS: técnico vê e insere as próprias
CREATE POLICY "tecnico_le_proprias_os" ON public.ordens_servico
  FOR SELECT USING (auth.uid() = tecnico_id);

CREATE POLICY "tecnico_insere_os" ON public.ordens_servico
  FOR INSERT WITH CHECK (auth.uid() = tecnico_id);

-- Admin tem acesso total
CREATE POLICY "admin_acesso_total_os" ON public.ordens_servico
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- ------------------------------------------------------------
-- Trigger: cria perfil automaticamente ao cadastrar usuário
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, funcao)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    'tecnico'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- Storage buckets
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('pdfs', 'pdfs', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('fotos', 'fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "upload_pdfs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'pdfs' AND auth.role() = 'authenticated');

CREATE POLICY "leitura_pdfs" ON storage.objects
  FOR SELECT USING (bucket_id = 'pdfs');

CREATE POLICY "upload_fotos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'fotos' AND auth.role() = 'authenticated');

CREATE POLICY "leitura_fotos" ON storage.objects
  FOR SELECT USING (bucket_id = 'fotos');
