'use client';

import { useRef, useState } from 'react';
import type { Voicemail } from '@/hooks/use-voicemails';

type Props = {
  voicemail: Voicemail;
  onMarkRead: (id: string) => Promise<void>;
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const urgencyColor = (urgency: string | null) => {
  switch (urgency) {
    case 'high':
      return 'text-red-400';
    case 'medium':
      return 'text-amber-400';
    case 'low':
      return 'text-green-400';
    default:
      return 'text-slate-400';
  }
};

export function VoicemailCard({ voicemail, onMarkRead }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isNew = voicemail.status === 'new' || voicemail.status === 'transcribed';
  const isProcessing = voicemail.status === 'new';

  const handlePlay = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
      if (isNew) {
        onMarkRead(voicemail.id);
      }
    }
  };

  const handleToggle = () => {
    setExpanded((v) => !v);
    if (isNew && !expanded) {
      onMarkRead(voicemail.id);
    }
  };

  return (
    <div
      className={`rounded-xl border transition-colors ${
        isNew
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-white/10 bg-white/3'
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {isNew && (
              <span className="flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red-500 mt-1.5 shadow-[0_0_6px_#ef4444]" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-100">
                  {voicemail.matched_customer_name || voicemail.ai_customer_name || voicemail.caller_number}
                </span>
                {isNew && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400 ring-1 ring-red-500/30">
                    New
                  </span>
                )}
                {isProcessing && (
                  <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    Processing…
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{voicemail.caller_number}</div>
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-slate-400">
              {new Date(voicemail.created_at).toLocaleDateString()} at{' '}
              {new Date(voicemail.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              {formatDuration(voicemail.duration)}
            </div>
          </div>
        </div>

        {voicemail.ai_summary && (
          <div className="mt-2 text-sm text-slate-300 line-clamp-2">{voicemail.ai_summary}</div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-white/10 px-4 pb-4 pt-3 space-y-4">
          {/* Audio player */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePlay}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d7b73f]/15 text-[#d7b73f] ring-1 ring-[#d7b73f]/30 transition hover:bg-[#d7b73f]/25"
            >
              {playing ? (
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M5 3h2v10H5zm4 0h2v10H9z" />
                </svg>
              ) : (
                <svg className="h-4 w-4 translate-x-0.5" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
                </svg>
              )}
            </button>
            <span className="text-xs text-slate-400">
              {playing ? 'Playing…' : 'Play voicemail'}
            </span>
          </div>
          <audio
            ref={audioRef}
            src={`/api/voicemails/${voicemail.id}/audio`}
            onEnded={() => setPlaying(false)}
            preload="none"
            className="hidden"
          />

          {/* AI extraction */}
          {(voicemail.ai_vehicle || voicemail.ai_issue || voicemail.ai_urgency) && (
            <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                AI Extraction
              </div>
              {voicemail.ai_customer_name && (
                <div className="flex gap-2 text-sm">
                  <span className="text-slate-400 w-20 flex-shrink-0">Customer</span>
                  <span className="text-slate-100">{voicemail.ai_customer_name}</span>
                </div>
              )}
              {voicemail.ai_vehicle && (
                <div className="flex gap-2 text-sm">
                  <span className="text-slate-400 w-20 flex-shrink-0">Vehicle</span>
                  <span className="text-slate-100">{voicemail.ai_vehicle}</span>
                </div>
              )}
              {voicemail.ai_issue && (
                <div className="flex gap-2 text-sm">
                  <span className="text-slate-400 w-20 flex-shrink-0">Issue</span>
                  <span className="text-slate-100">{voicemail.ai_issue}</span>
                </div>
              )}
              {voicemail.ai_urgency && (
                <div className="flex gap-2 text-sm">
                  <span className="text-slate-400 w-20 flex-shrink-0">Urgency</span>
                  <span className={`font-semibold capitalize ${urgencyColor(voicemail.ai_urgency)}`}>
                    {voicemail.ai_urgency}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Transcript */}
          {voicemail.transcript && (
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-400">
                Transcript
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{voicemail.transcript}</p>
            </div>
          )}

          {voicemail.status === 'new' && !voicemail.transcript && (
            <p className="text-xs text-slate-500 italic">Transcription in progress…</p>
          )}
          {voicemail.status === 'transcription_failed' && (
            <p className="text-xs text-red-400">Transcription failed. Audio still available above.</p>
          )}
        </div>
      )}
    </div>
  );
}
