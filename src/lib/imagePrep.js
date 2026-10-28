const MAX_DIM = 1400

// Converte uma foto em JPEG base64 reduzido. Retorna { base64, width, height }.
export function photoToImage(file, maxDim = MAX_DIM) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const width = Math.round(img.width * scale)
      const height = Math.round(img.height * scale)

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, width, height)

      const base64 = canvas.toDataURL('image/jpeg', 0.82).split(',')[1]
      resolve({ base64, width, height })
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Falha ao ler a imagem')) }
    img.src = url
  })
}
