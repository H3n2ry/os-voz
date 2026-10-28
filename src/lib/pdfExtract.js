import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href

// Renderiza a 1ª página do PDF como JPEG base64, reduzido para caber em maxDim.
// Retorna { base64, width, height } (dimensões em px da imagem gerada).
export async function pdfToImage(file, maxDim = 1400) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)

  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(2, maxDim / Math.max(base.width, base.height))
  const viewport = page.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)

  const ctx = canvas.getContext('2d')
  await page.render({ canvasContext: ctx, viewport }).promise

  const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
  return { base64, width: canvas.width, height: canvas.height }
}
