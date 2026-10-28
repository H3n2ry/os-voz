const BASE = (import.meta.env.VITE_API_URL || 'https://os-voz-api.afdevs.workers.dev')
  .replace(/[^\x21-\x7E]/g, '')

function getToken() {
  return localStorage.getItem('os_voz_token')
}

async function parseResponse(res) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { error: text.slice(0, 200) }
  }
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await parseResponse(res)
  if (!res.ok) {
    const e = new Error(data.error || `Erro ${res.status} na requisição`)
    e.status = res.status
    throw e
  }
  return data
}

export const api = {
  auth: {
    register: (email, senha, nome) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify({ email, senha, nome }) }),
    login: (email, senha) =>
      request('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) }),
    me: () => request('/auth/me'),
  },

  os: {
    list: () => request('/os'),
    listAll: () => request('/os/admin'),
    proximoNumero: () => request('/os/proximo-numero'),
    create: (data) => request('/os', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, status) =>
      request(`/os/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  },

  molde: {
    get: () => request('/molde'),
    save: (data) => request('/molde', { method: 'PUT', body: JSON.stringify(data) }),
    remove: () => request('/molde', { method: 'DELETE' }),
  },

  transcribe: (audioBlob) => {
    const token = getToken()
    const formData = new FormData()
    formData.append('audio', audioBlob, 'audio.webm')
    return fetch(`${BASE}/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    }).then(async (r) => {
      const data = await parseResponse(r)
      if (!r.ok) throw new Error(data.error || `Erro ${r.status} na transcrição`)
      return data
    })
  },

  // relato = transcrição/texto informal; campos = [{ key, label }]
  gerarOS: ({ relato, campos }) =>
    request('/gerar-os', { method: 'POST', body: JSON.stringify({ relato, campos }) }),
}
