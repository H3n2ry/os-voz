import { Document, Page, Image, Text, View, StyleSheet, pdf } from '@react-pdf/renderer'
import { CAMPOS_OS } from './osFields'

// Ordem e rótulos das seções no documento. Reaproveita a lista padrão.
const TOPO = ['cliente', 'endereco', 'empresa_contratante', 'responsavel']
const SECOES = CAMPOS_OS.filter((c) => !TOPO.includes(c.key))

const s = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, fontFamily: 'Helvetica', color: '#18181b' },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  logo: { width: 64, height: 64, objectFit: 'contain', marginRight: 14 },
  empresaBox: { flex: 1 },
  empresa: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  empresaSub: { fontSize: 9, color: '#64748b', marginTop: 2 },

  titleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    borderBottomWidth: 2, borderBottomColor: '#2563eb', paddingBottom: 6, marginBottom: 16,
  },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#2563eb', letterSpacing: 0.5 },
  meta: { fontSize: 9, color: '#475569', textAlign: 'right', lineHeight: 1.4 },

  topGrid: { flexDirection: 'row', marginBottom: 14 },
  topCol: { flex: 1, paddingRight: 10 },
  fieldLabel: { fontSize: 8, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  fieldValue: { fontSize: 11, color: '#0f172a' },

  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#334155',
    textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4,
  },
  sectionBody: {
    fontSize: 10.5, color: '#1e293b', lineHeight: 1.5,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4,
    padding: 8,
  },

  footer: { marginTop: 'auto', paddingTop: 18, flexDirection: 'row', justifyContent: 'space-between' },
  sign: { width: '45%', alignItems: 'center' },
  signLine: { borderTopWidth: 1, borderTopColor: '#94a3b8', width: '100%', marginBottom: 4 },
  signLabel: { fontSize: 8, color: '#64748b' },
})

function v(valores, key) {
  const val = valores?.[key]
  return val && String(val).trim() ? String(val).trim() : null
}

// PDF profissional montado pela IA: cabeçalho da empresa + dados + seções.
function OSDocument({ header, os }) {
  const valores = os.valores || {}
  const numero = String(os.numero_os ?? '').padStart(4, '0')
  const logoSrc = header?.logo ? `data:image/jpeg;base64,${header.logo}` : null
  const responsavel = v(valores, 'responsavel') || header?.responsavel || os.tecnico || ''

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Cabeçalho da empresa */}
        {(logoSrc || header?.empresa) && (
          <View style={s.header}>
            {logoSrc && <Image src={logoSrc} style={s.logo} />}
            <View style={s.empresaBox}>
              {header?.empresa ? <Text style={s.empresa}>{header.empresa}</Text> : null}
              {header?.cnpj ? <Text style={s.empresaSub}>CNPJ: {header.cnpj}</Text> : null}
              {header?.telefone ? <Text style={s.empresaSub}>{header.telefone}</Text> : null}
            </View>
          </View>
        )}

        {/* Título + número/data */}
        <View style={s.titleRow}>
          <Text style={s.title}>ORDEM DE SERVIÇO</Text>
          <Text style={s.meta}>Nº {numero}{'\n'}{os.data || ''} {os.hora || ''}</Text>
        </View>

        {/* Identificação */}
        <View style={s.topGrid}>
          <View style={s.topCol}>
            <Text style={s.fieldLabel}>Cliente</Text>
            <Text style={s.fieldValue}>{v(valores, 'cliente') || '—'}</Text>
          </View>
          <View style={s.topCol}>
            <Text style={s.fieldLabel}>Endereço</Text>
            <Text style={s.fieldValue}>{v(valores, 'endereco') || '—'}</Text>
          </View>
        </View>

        {v(valores, 'empresa_contratante') ? (
          <View style={s.topGrid}>
            <View style={s.topCol}>
              <Text style={s.fieldLabel}>Empresa contratante</Text>
              <Text style={s.fieldValue}>{v(valores, 'empresa_contratante')}</Text>
            </View>
          </View>
        ) : null}

        {/* Seções de conteúdo */}
        {SECOES.map((c) => {
          const val = v(valores, c.key)
          if (!val) return null
          return (
            <View key={c.key} style={s.section}>
              <Text style={s.sectionTitle}>{c.label}</Text>
              <Text style={s.sectionBody}>{val}</Text>
            </View>
          )
        })}

        {/* Assinaturas */}
        <View style={s.footer}>
          <View style={s.sign}>
            <View style={s.signLine} />
            <Text style={s.signLabel}>{responsavel || 'Responsável'}</Text>
          </View>
          <View style={s.sign}>
            <View style={s.signLine} />
            <Text style={s.signLabel}>Cliente</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

function fileName(os) {
  const cliente = (os.valores?.cliente || os.cliente || 'OS').toString().replace(/\s+/g, '_')
  return `OS_${String(os.numero_os ?? '').padStart(4, '0')}_${cliente}.pdf`
}

async function download(doc, name) {
  const blob = await pdf(doc).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// Gera e baixa o PDF da OS no layout profissional padrão.
// `header` = perfil do cabeçalho ({ logo, empresa, telefone, responsavel }) ou null.
export async function downloadOSPDF(header, os) {
  return download(<OSDocument header={header} os={os} />, fileName(os))
}
