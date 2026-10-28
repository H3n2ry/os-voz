import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `Você é um assistente especializado em gerar Ordens de Serviço (OS) para equipes de
manutenção e campo. Receberá dois inputs:

1. ESBOÇO: rascunho inicial da OS com dados do cliente e tipo de serviço
2. RELATO: transcrição do áudio do técnico descrevendo o que foi executado

Gere uma OS estruturada em JSON com os seguintes campos:
{
  "numero_os": "(use o valor fornecido pelo sistema)",
  "data": "(use a data fornecida pelo sistema no formato DD/MM/AAAA)",
  "hora": "(use a hora fornecida pelo sistema)",
  "cliente": "(extraído do esboço)",
  "endereco": "(extraído do esboço)",
  "tipo_servico": "(extraído do esboço)",
  "tecnico": "(use o nome fornecido pelo sistema)",
  "descricao_servico": "(resumo claro do que foi feito, baseado no relato)",
  "materiais_utilizados": ["(lista de materiais mencionados no relato)"],
  "observacoes": "(observações relevantes do relato)",
  "status": "gerada"
}

Responda APENAS com o JSON, sem texto adicional, sem markdown.`

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { esboco_text, esboco_foto_url, transcricao, tecnico_nome, numero_os } = await req.json()

    if (!transcricao) {
      return new Response(JSON.stringify({ error: 'Transcrição é obrigatória' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const now = new Date()
    const data = now.toLocaleDateString('pt-BR')
    const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    const contexto = `TÉCNICO: ${tecnico_nome}\nNÚMERO OS: ${numero_os}\nDATA: ${data}\nHORA: ${hora}`

    const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

    // deno-lint-ignore no-explicit-any
    let messageContent: any

    if (esboco_foto_url) {
      const imgRes = await fetch(esboco_foto_url)
      const imgBuffer = await imgRes.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)))
      const mediaType = (imgRes.headers.get('content-type') || 'image/jpeg') as
        'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

      messageContent = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
        { type: 'text', text: `RELATO:\n${transcricao}\n\n${contexto}` },
      ]
    } else {
      messageContent = `ESBOÇO:\n${esboco_text ?? ''}\n\nRELATO:\n${transcricao}\n\n${contexto}`
    }

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: messageContent }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    const osJson = JSON.parse(raw)

    return new Response(JSON.stringify(osJson), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
