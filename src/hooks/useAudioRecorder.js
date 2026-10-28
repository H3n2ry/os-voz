import { useState, useRef, useCallback } from 'react'

function getBestMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(null)

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const startRef = useRef(null)

  const startRecording = useCallback(async () => {
    setError(null)
    setAudioBlob(null)
    setDuration(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getBestMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        setAudioBlob(blob)
        stream.getTracks().forEach((t) => t.stop())
      }

      recorder.start(100)
      startRef.current = Date.now()
      setIsRecording(true)

      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startRef.current) / 1000))
      }, 1000)
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Permissão ao microfone negada. Habilite nas configurações do navegador.'
          : 'Não foi possível acessar o microfone.'
      )
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (recorderRef.current && isRecording) {
      recorderRef.current.stop()
      setIsRecording(false)
      clearInterval(timerRef.current)
    }
  }, [isRecording])

  const resetRecording = useCallback(() => {
    setAudioBlob(null)
    setDuration(0)
    setError(null)
  }, [])

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  return {
    isRecording,
    audioBlob,
    duration,
    formattedDuration: formatDuration(duration),
    error,
    startRecording,
    stopRecording,
    resetRecording,
  }
}
