import { useState, useEffect } from 'react'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { api } from '../lib/api'

function Waveform() {
  return (
    <div className="flex items-center gap-1 h-8">
      {[0, 0.15, 0.3, 0.15, 0].map((delay, i) => (
        <div
          key={i}
          className="w-1.5 bg-red-500 rounded-full animate-wave"
          style={{ animationDelay: `${delay}s`, height: '100%' }}
        />
      ))}
    </div>
  )
}

export default function AudioRecorder({ onTranscricao, onComplete, disabled }) {
  const {
    isRecording,
    audioBlob,
    formattedDuration,
    error,
    startRecording,
    stopRecording,
    resetRecording,
  } = useAudioRecorder()

  const [transcribing, setTranscribing] = useState(false)
  const [transcricao, setTranscricao] = useState('')
  const [transcError, setTranscError] = useState('')

  // Transcreve automaticamente assim que a gravação termina
  useEffect(() => {
    if (audioBlob && !transcricao && !transcribing) transcrever()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBlob])

  async function transcrever() {
    if (!audioBlob) return
    setTranscribing(true)
    setTranscError('')
    try {
      const { transcricao: text } = await api.transcribe(audioBlob)
      setTranscricao(text)
      onTranscricao?.(text)
      if (text && text.trim()) onComplete?.(text)
    } catch (err) {
      setTranscError(err.message)
    } finally {
      setTranscribing(false)
    }
  }

  function handleReset() {
    resetRecording()
    setTranscricao('')
    setTranscError('')
    onTranscricao?.('')
  }

  const idle = !isRecording && !audioBlob

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || transcribing || (!!audioBlob && !isRecording)}
          className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
            isRecording
              ? 'bg-red-600 scale-110 shadow-red-900'
              : audioBlob
              ? 'bg-zinc-700 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 active:scale-95'
          }`}
        >
          {isRecording ? (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-white">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-9 h-9 text-white">
              <path d="M12 1a4 4 0 014 4v6a4 4 0 01-8 0V5a4 4 0 014-4zm0 2a2 2 0 00-2 2v6a2 2 0 004 0V5a2 2 0 00-2-2zm-7 9a7 7 0 0014 0h2a9 9 0 01-8 8.94V23h-2v-2.06A9 9 0 013 12H5z" />
            </svg>
          )}
          {isRecording && (
            <span className="absolute inset-0 rounded-full bg-red-500 opacity-40 animate-ping" />
          )}
        </button>

        {/* Mensagem de estado, grande e clara */}
        {idle && (
          <p className="text-base font-medium text-zinc-200">Toque para falar o serviço</p>
        )}

        {isRecording && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              <Waveform />
              <span className="text-red-400 text-sm font-mono tabular-nums">{formattedDuration}</span>
            </div>
            <p className="text-sm text-zinc-400">Toque de novo para parar</p>
          </div>
        )}

        {transcribing && (
          <div className="flex items-center gap-2 text-blue-400">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Entendendo o que você falou...</span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      {transcError && (
        <div className="text-center space-y-2">
          <p className="text-xs text-red-400">{transcError}</p>
          <button onClick={handleReset} className="text-xs text-blue-400 hover:text-blue-300">
            Tentar de novo
          </button>
        </div>
      )}

      {transcricao && !transcribing && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500 uppercase tracking-wide">Você disse</p>
            <button onClick={handleReset} className="text-xs text-blue-400 hover:text-blue-300">
              Regravar
            </button>
          </div>
          <p className="text-sm text-zinc-200 bg-zinc-800 rounded-lg p-3 leading-relaxed">{transcricao}</p>
        </div>
      )}
    </div>
  )
}
