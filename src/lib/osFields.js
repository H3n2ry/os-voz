// Campos padrão de uma Ordem de Serviço. A IA preenche todos a partir do relato.
// O usuário não marca nem posiciona nada — o layout é montado automaticamente.
export const CAMPOS_OS = [
  { key: 'cliente',             label: 'Cliente' },
  { key: 'endereco',            label: 'Endereço' },
  { key: 'empresa_contratante', label: 'Empresa contratante' },
  { key: 'servico',             label: 'Serviço executado', multiline: true },
  { key: 'materiais',           label: 'Materiais utilizados', multiline: true },
  { key: 'observacoes',         label: 'Observações', multiline: true },
  { key: 'responsavel',         label: 'Responsável' },
]
