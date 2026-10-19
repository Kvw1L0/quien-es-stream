'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  Upload,
  Play,
  Pause,
  Eye,
  Trophy,
  QrCode,
  Users,
  Trash2,
  RotateCcw,
  Volume2,
  VolumeX,
  Tv,
  Smartphone,
  Sparkles,
  Check,
  Edit3,
  SkipForward,
  Sliders,
  BarChart3,
  Lock,
  Lightbulb,
  Zap,
  Drum,
} from 'lucide-react';
import DistortedCanvas from '@/components/DistortedCanvas';

const EFFECT_OPTIONS = [
  { id: 'SWIRL_BLUR', label: 'Remolino + Blur (Deformado)' },
  { id: 'PIXELATE', label: 'Pixelado Retro' },
  { id: 'BLUR', label: 'Difuminado Intenso' },
  { id: 'ZOOM', label: 'Zoom Extremo al Centro' },
];

const TIMER_PRESETS = [10, 15, 20, 30, 45];
const MULTIPLIER_PRESETS = [
  { value: 1, label: 'x1 Normal' },
  { value: 2, label: 'x2 DOBLE' },
  { value: 3, label: 'x3 TRIPLE ORO' },
];

async function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 520;
        let width = img.width;
        let height = img.height;

        const minSide = Math.min(width, height);
        const sx = (width - minSide) / 2;
        const sy = (height - minSide) / 2;

        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, MAX_SIZE, MAX_SIZE);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        resolve({
          name: formattedName || 'Personaje',
          hint: '',
          imageData: dataUrl,
        });
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminDashboardPage() {
  const [gameState, setGameState] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [editingPhotoId, setEditingPhotoId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editHint, setEditHint] = useState('');
  const [editDistractors, setEditDistractors] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [liveHintInput, setLiveHintInput] = useState('');
  const [scrubberVal, setScrubberVal] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    async function pollAdmin() {
      try {
        const res = await fetch('/api/game?role=admin', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setGameState(data);
        if (!selectedPhotoId && data.photos?.length > 0) {
          const nextUnplayed =
            data.photos.find((p) => !p.played) || data.photos[0];
          setSelectedPhotoId(nextUnplayed.id);
        }
      } catch (e) {}
    }

    pollAdmin();
    const interval = setInterval(pollAdmin, 500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedPhotoId]);

  // Sync live hint input when round changes
  useEffect(() => {
    if (gameState?.activeRound) {
      setLiveHintInput(gameState.activeRound.hintText || '');
    }
  }, [gameState?.activeRound?.roundId]);

  async function sendAction(action, payload = {}) {
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, role: 'admin', ...payload }),
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data);
        return data;
      }
    } catch (e) {
      console.error('Admin action error:', e);
    }
  }

  async function handleFilesUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      const filesArray = Array.from(fileList).filter((f) =>
        f.type.startsWith('image/')
      );
      const processed = [];
      for (const file of filesArray) {
        const item = await compressImageFile(file);
        processed.push(item);
      }
      if (processed.length > 0) {
        const updated = await sendAction('ADD_PHOTOS_BATCH', {
          photos: processed,
        });
        if (updated?.photos?.length > 0 && !selectedPhotoId) {
          setSelectedPhotoId(updated.photos[0].id);
        }
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function startEditingPhoto(photo) {
    setEditingPhotoId(photo.id);
    setEditName(photo.name);
    setEditHint(photo.hint || '');
    setEditDistractors((photo.customDistractors || []).join(', '));
  }

  async function savePhotoEdit(photoId) {
    const distractorsArray = editDistractors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    await sendAction('UPDATE_PHOTO', {
      photoId,
      name: editName,
      hint: editHint,
      customDistractors: distractorsArray,
    });
    setEditingPhotoId(null);
  }

  async function handleStartNextUnplayed() {
    if (!gameState?.photos?.length) return;
    const nextPhoto =
      gameState.photos.find(
        (p) => !p.played && p.id !== gameState.activeRound?.photoId
      ) ||
      gameState.photos.find((p) => !p.played) ||
      gameState.photos[0];
    if (nextPhoto) {
      setSelectedPhotoId(nextPhoto.id);
      setScrubberVal(null);
      await sendAction('START_ROUND', {
        photoId: nextPhoto.id,
        durationSeconds: gameState.settings?.timerDuration || 15,
        effectType: gameState.settings?.effectType || 'SWIRL_BLUR',
        pointsMultiplier: gameState.settings?.pointsMultiplier || 1,
      });
    }
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-[#002b36] text-white flex items-center justify-center font-bold">
        Cargando Panel de Director...
      </div>
    );
  }

  const phase = gameState.phase;
  const round = gameState.activeRound;
  const settings = gameState.settings || {};
  const photos = gameState.photos || [];
  const players = gameState.allPlayers || [];
  const isTimeUp = phase === 'PLAYING' && round?.isTimeUp;

  return (
    <div className="min-h-screen bg-[#071e26] text-slate-100 p-4 md:p-6">
      {/* Top Broadcast Header */}
      <header className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 bg-[#0b2b36] border border-[#008296]/40 rounded-3xl px-6 py-4 mb-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-[#ff5500] animate-ping" />
          <div>
            <h1 className="font-display text-2xl font-black tracking-wide text-white uppercase">
              DIRECTOR DE STREAMING — HOGAR DE CRISTO
            </h1>
            <p className="text-xs text-slate-300 font-medium">
              Suite completa de producción en vivo: Redoble 3-2-1, Pistas en Zócalo, Puntos x2/x3, Slider de Claridad y Reacciones.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/tv"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#008296] hover:bg-[#009fb8] text-white font-bold text-xs transition shadow"
          >
            <Tv className="w-4 h-4" />
            Abrir Pantalla TV (/tv)
          </a>
          <a
            href="/play"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#e5a93c] hover:bg-[#f0b84d] text-[#003d4a] font-extrabold text-xs transition shadow"
          >
            <Smartphone className="w-4 h-4" />
            Abrir Vista Jugador (/play)
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (8 cols): Live Show Controls & Photo Batch Manager */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. LIVE SWITCHER DECK */}
          <section className="bg-[#0b2b36] border border-[#008296]/40 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-[#00b4cc] flex items-center gap-2">
                <Sliders className="w-4 h-4" />
                Mesa de Dirección en Vivo (TV y Celulares)
              </h2>
              <span
                className={`px-3.5 py-1 rounded-full text-xs font-black uppercase ${
                  isTimeUp
                    ? 'bg-[#ff5500] text-white animate-pulse'
                    : 'bg-[#008296]/30 border border-[#00b4cc]/40 text-[#00b4cc]'
                }`}
              >
                {isTimeUp
                  ? 'TIEMPO TERMINADO — ESPERANDO TU REVELACIÓN MANUAL'
                  : `ESTADO EN AIRE: ${phase}`}
              </span>
            </div>

            {/* Scene Switcher Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-6">
              <button
                onClick={() => sendAction('SET_PHASE', { phase: 'LOBBY' })}
                className={`flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-2xl font-black text-xs border transition ${
                  phase === 'LOBBY'
                    ? 'bg-[#008296] border-white text-white shadow-lg'
                    : 'bg-[#071e26] border-white/10 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <QrCode className="w-4 h-4 shrink-0" />
                1. LOBBY QR
              </button>

              <button
                onClick={() => {
                  setScrubberVal(null);
                  sendAction('START_ROUND', {
                    photoId: selectedPhotoId,
                    durationSeconds: settings.timerDuration || 15,
                    effectType: settings.effectType || 'SWIRL_BLUR',
                    pointsMultiplier: settings.pointsMultiplier || 1,
                  });
                }}
                className="flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-2xl font-black text-xs bg-[#84bd00] hover:bg-[#96d600] text-[#002b36] shadow-lg transition"
              >
                <Play className="w-4 h-4 fill-current shrink-0" />
                2. LANZAR FOTO
              </button>

              {/* FEATURE 6: 3-Second Drumroll Climax Reveal Button */}
              <button
                onClick={() => sendAction('START_DRUMROLL_REVEAL')}
                disabled={!round || phase === 'REVEALED' || round?.isDrumrolling}
                className={`flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-2xl font-black text-xs border-2 transition ${
                  round?.isDrumrolling
                    ? 'bg-[#e5a93c] border-white text-[#002b36] animate-pulse'
                    : isTimeUp
                    ? 'bg-gradient-to-r from-[#ff5500] to-[#e5a93c] border-white text-white animate-bounce shadow-[0_0_25px_rgba(255,85,0,0.6)]'
                    : 'bg-[#071e26] border-[#ff5500]/50 text-[#ff5500] hover:bg-[#ff5500] hover:text-white disabled:opacity-40'
                }`}
                title="Hace vibrar la pantalla TV con cuenta regresiva 3..2..1 y sonido de tambores antes de revelar"
              >
                <Drum className="w-4 h-4 shrink-0" />
                3A. REDOBLE 3-2-1
              </button>

              <button
                onClick={() => sendAction('REVEAL_NOW')}
                disabled={!round}
                className={`flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-2xl font-black text-xs border-2 transition ${
                  phase === 'REVEALED'
                    ? 'bg-[#e5a93c] border-white text-[#002b36]'
                    : 'bg-[#071e26] border-[#e5a93c]/50 text-[#e5a93c] hover:bg-[#e5a93c] hover:text-[#002b36] disabled:opacity-40'
                }`}
              >
                <Eye className="w-4 h-4 shrink-0" />
                3B. REVELAR YA
              </button>

              <button
                onClick={() => sendAction('SET_PHASE', { phase: 'RANKING' })}
                className={`flex items-center justify-center gap-1.5 py-3.5 px-3 rounded-2xl font-black text-xs border transition ${
                  phase === 'RANKING'
                    ? 'bg-[#e5a93c] border-white text-[#002b36] shadow-lg'
                    : 'bg-[#071e26] border-white/10 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Trophy className="w-4 h-4 text-[#e5a93c] shrink-0" />
                4. RANKING
              </button>
            </div>

            {/* Active Round Monitor, Live Hint Lower-Third & Manual Clarity Scrubber */}
            {round && (
              <div
                className={`rounded-2xl p-4 mb-5 border-2 transition space-y-4 ${
                  isTimeUp
                    ? 'bg-[#ff5500]/15 border-[#ff5500]'
                    : 'bg-[#071e26] border-[#008296]/40'
                }`}
              >
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-[#008296] shrink-0 bg-black">
                      <DistortedCanvas
                        imageSrc={round.imageData}
                        progress={round.progress}
                        effectType={round.effectType}
                        isRevealed={phase === 'REVEALED'}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-[#e5a93c] uppercase">
                          Personaje Secreto: {round.correctName}
                        </span>
                        {round.pointsMultiplier > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-[#ff5500] text-white text-[10px] font-black">
                            RONDA x{round.pointsMultiplier}
                          </span>
                        )}
                      </div>
                      <div className="text-base font-black text-white flex items-center gap-2 mt-0.5">
                        {phase === 'PLAYING' && !isTimeUp && (
                          <span>
                            Tiempo restante:{' '}
                            {Math.ceil((round.remainingMs || 0) / 1000)}s
                          </span>
                        )}
                        {phase === 'PLAYING' && isTimeUp && (
                          <span className="text-[#ff5500] flex items-center gap-1.5">
                            <Lock className="w-4 h-4" /> ¡Tiempo agotado! Usa
                            &quot;3A. REDOBLE 3-2-1&quot; o &quot;3B. REVELAR YA&quot;
                          </span>
                        )}
                        {phase === 'REVEALED' && (
                          <span className="text-[#84bd00]">
                            ¡Respuesta revelada!
                            {round.fastestWinner && (
                              <span className="ml-2 text-[#e5a93c]">
                                ⚡ Más rápido: {round.fastestWinner.name} (
                                {(round.fastestWinner.elapsedMs / 1000).toFixed(2)}s)
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-300 font-semibold">
                        Votos recibidos: {round.totalVotes || 0} de{' '}
                        {players.length} jugadores
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => sendAction('TOGGLE_AUDIENCE_VOTES')}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-black text-xs border-2 transition ${
                        round.showAudienceVotes
                          ? 'bg-[#00b4cc] text-[#002b36] border-white shadow-[0_0_20px_rgba(0,180,204,0.5)]'
                          : 'bg-[#0b2b36] text-[#00b4cc] border-[#00b4cc]/50 hover:bg-[#00b4cc]/20'
                      }`}
                      title="Activa o desactiva en la pantalla gigante las 4 alternativas y el avance de sus porcentajes"
                    >
                      <BarChart3 className="w-4 h-4" />
                      {round.showAudienceVotes
                        ? 'OCULTAR ALTERNATIVAS Y % EN TV'
                        : 'MOSTRAR ALTERNATIVAS Y % EN TV'}
                    </button>

                    {phase === 'PLAYING' && !isTimeUp && (
                      <button
                        onClick={() => sendAction('TOGGLE_PAUSE')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs border ${
                          round.isPaused
                            ? 'bg-[#e5a93c] text-[#002b36] border-white'
                            : 'bg-[#0b2b36] text-white border-white/20'
                        }`}
                      >
                        {round.isPaused ? (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" /> REANUDAR
                          </>
                        ) : (
                          <>
                            <Pause className="w-3.5 h-3.5" /> CONGELAR
                          </>
                        )}
                      </button>
                    )}

                    <button
                      onClick={handleStartNextUnplayed}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#008296] hover:bg-[#009fb8] text-white font-black text-xs shadow"
                    >
                      <SkipForward className="w-3.5 h-3.5" />
                      SIGUIENTE FOTO
                    </button>
                  </div>
                </div>

                {/* FEATURE 4 & 5: Lower-Third Hint Controls + Manual Clarity Scrubber */}
                {phase === 'PLAYING' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3 border-t border-white/10">
                    {/* Lower-third TV Hint launcher */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={liveHintInput}
                        onChange={(e) => setLiveHintInput(e.target.value)}
                        placeholder="Escribe una pista en vivo para el zócalo de TV..."
                        className="flex-1 px-3 py-2 rounded-xl bg-[#0b2b36] border border-white/15 text-xs font-bold text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          sendAction('UPDATE_LIVE_HINT', {
                            hintText: liveHintInput,
                            showHintOnTv: !round.showHintOnTv,
                          })
                        }
                        className={`px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shrink-0 border transition ${
                          round.showHintOnTv
                            ? 'bg-[#e5a93c] text-[#002b36] border-white'
                            : 'bg-[#0b2b36] text-[#e5a93c] border-[#e5a93c]/40 hover:bg-[#e5a93c]/20'
                        }`}
                      >
                        <Lightbulb className="w-4 h-4" />
                        {round.showHintOnTv ? 'OCULTAR PISTA' : 'LANZAR PISTA TV'}
                      </button>
                    </div>

                    {/* Manual Clarity Slider (Director Scrubber) */}
                    <div className="flex items-center gap-3 bg-[#0b2b36] px-3.5 py-2 rounded-xl border border-white/10">
                      <span className="text-[11px] font-extrabold uppercase text-[#00b4cc] whitespace-nowrap">
                        Claridad Manual:
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={
                          scrubberVal !== null
                            ? scrubberVal
                            : Math.round((round.progress || 0) * 100)
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setScrubberVal(val);
                          sendAction('SET_MANUAL_PROGRESS', {
                            progress: val / 100,
                          });
                        }}
                        className="flex-1 accent-[#e5a93c] cursor-pointer"
                      />
                      {typeof round.manualProgress === 'number' && (
                        <button
                          type="button"
                          onClick={() => {
                            setScrubberVal(null);
                            sendAction('SET_MANUAL_PROGRESS', { progress: null });
                          }}
                          className="text-[10px] font-black px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Round Settings (Effect Type, Timer Duration, Points Multiplier, TV Overlay Options) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-white/10">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5">
                  Efecto de Distorsión
                </label>
                <select
                  value={settings.effectType || 'SWIRL_BLUR'}
                  onChange={(e) =>
                    sendAction('UPDATE_SETTINGS', {
                      settings: { effectType: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#071e26] border border-white/15 text-xs font-bold text-white"
                >
                  {EFFECT_OPTIONS.map((ef) => (
                    <option key={ef.id} value={ef.id}>
                      {ef.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5">
                  Duración del Timer
                </label>
                <div className="flex items-center gap-1">
                  {TIMER_PRESETS.map((sec) => (
                    <button
                      key={sec}
                      onClick={() =>
                        sendAction('UPDATE_SETTINGS', {
                          settings: { timerDuration: sec },
                        })
                      }
                      className={`flex-1 py-2 rounded-xl font-black text-xs border transition ${
                        settings.timerDuration === sec
                          ? 'bg-[#008296] border-white text-white'
                          : 'bg-[#071e26] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* FEATURE 3: x1 / x2 / x3 Point Multiplier Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-[#e5a93c] mb-1.5">
                  Multiplicador de Puntos
                </label>
                <div className="flex items-center gap-1">
                  {MULTIPLIER_PRESETS.map((m) => (
                    <button
                      key={m.value}
                      onClick={() =>
                        sendAction('UPDATE_SETTINGS', {
                          settings: { pointsMultiplier: m.value },
                        })
                      }
                      className={`flex-1 py-2 rounded-xl font-black text-[11px] border transition ${
                        (settings.pointsMultiplier || 1) === m.value
                          ? m.value > 1
                            ? 'bg-gradient-to-r from-[#ff5500] to-[#e5a93c] border-white text-white shadow'
                            : 'bg-[#008296] border-white text-white'
                          : 'bg-[#071e26] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-300 mb-1.5">
                  Opciones de TV / OBS
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() =>
                      sendAction('UPDATE_SETTINGS', {
                        settings: { showQrOnTv: !settings.showQrOnTv },
                      })
                    }
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs border flex items-center justify-center gap-1 ${
                      settings.showQrOnTv
                        ? 'bg-[#84bd00]/20 border-[#84bd00] text-[#84bd00]'
                        : 'bg-[#071e26] border-white/10 text-slate-500'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    {settings.showQrOnTv ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={() =>
                      sendAction('UPDATE_SETTINGS', {
                        settings: { soundEnabled: !settings.soundEnabled },
                      })
                    }
                    className={`py-2 px-2.5 rounded-xl font-bold text-xs border flex items-center justify-center ${
                      settings.soundEnabled
                        ? 'bg-[#008296]/30 border-[#00b4cc] text-[#00b4cc]'
                        : 'bg-[#071e26] border-white/10 text-slate-500'
                    }`}
                    title="Sonidos en TV"
                  >
                    {settings.soundEnabled ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                  </button>

                  <select
                    value={settings.chromaMode || 'DARK'}
                    onChange={(e) =>
                      sendAction('UPDATE_SETTINGS', {
                        settings: { chromaMode: e.target.value },
                      })
                    }
                    className="flex-1 py-2 px-2 rounded-xl bg-[#071e26] border border-white/15 text-[11px] font-bold text-white"
                    title="Fondo de TV"
                  >
                    <option value="DARK">Key Visual</option>
                    <option value="TRANSPARENT">Transparente</option>
                    <option value="GREEN">Chroma</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* 2. BATCH PHOTO UPLOADER & THUMBNAIL QUEUE */}
          <section className="bg-[#0b2b36] border border-[#008296]/40 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#e5a93c]" />
                  Lote de Fotos Cargadas ({photos.length})
                </h2>
                <p className="text-xs text-slate-300">
                  Arrastra todas las fotos del show. Puedes pre-configurar una pista (zócalo) y distractores en cada miniatura.
                </p>
              </div>

              {photos.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('¿Vaciar todas las fotos del lote?')) {
                      sendAction('CLEAR_ALL_PHOTOS');
                    }
                  }}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Vaciar Lote
                </button>
              )}
            </div>

            {/* Drag and Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFilesUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition mb-6 ${
                isDragging
                  ? 'border-[#e5a93c] bg-[#e5a93c]/10'
                  : 'border-[#008296]/50 hover:border-[#00b4cc] bg-[#071e26]/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFilesUpload(e.target.files)}
              />
              <Upload className="w-8 h-8 text-[#00b4cc] mx-auto mb-2" />
              <div className="font-extrabold text-sm text-white">
                {uploading
                  ? 'Procesando lote de imágenes...'
                  : 'Arrastra aquí las fotos en lote o haz clic para subirlas'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Las miniaturas quedan listas abajo para que elijas cuál lanzar al aire.
              </div>
            </div>

            {/* Thumbnail Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {photos.map((photo, index) => {
                const isSelected = selectedPhotoId === photo.id;
                const isOnAir = round?.photoId === photo.id;
                const isEditing = editingPhotoId === photo.id;

                return (
                  <div
                    key={photo.id}
                    onClick={() => setSelectedPhotoId(photo.id)}
                    className={`group relative rounded-2xl overflow-hidden border-2 transition cursor-pointer flex flex-col justify-between bg-[#071e26] ${
                      isOnAir
                        ? 'border-[#84bd00] shadow-[0_0_25px_rgba(132,189,0,0.3)]'
                        : isSelected
                        ? 'border-[#e5a93c]'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    <div className="relative h-40 w-full bg-slate-900 overflow-hidden">
                      <img
                        src={photo.imageData}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-black/75 text-white font-black text-xs">
                          #{index + 1}
                        </span>
                        {isOnAir && (
                          <span className="px-2.5 py-0.5 rounded-full bg-[#84bd00] text-[#002b36] font-black text-xs">
                            EN AIRE
                          </span>
                        )}
                        {!isOnAir && photo.played && (
                          <span className="px-2.5 py-0.5 rounded-full bg-black/80 text-slate-300 font-bold text-xs">
                            JUGADA
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          sendAction('DELETE_PHOTO', { photoId: photo.id });
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 text-rose-400 hover:bg-rose-600 hover:text-white opacity-0 group-hover:opacity-100 transition"
                        title="Eliminar foto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="p-3.5 flex-1 flex flex-col justify-between">
                      {isEditing ? (
                        <div
                          className="space-y-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Nombre correcto"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#0b2b36] border border-[#00b4cc] text-white text-xs font-bold"
                          />
                          <input
                            type="text"
                            value={editHint}
                            onChange={(e) => setEditHint(e.target.value)}
                            placeholder="Pista opcional para TV (ej. Actor chileno)"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#0b2b36] border border-[#e5a93c]/50 text-slate-200 text-[11px]"
                          />
                          <input
                            type="text"
                            value={editDistractors}
                            onChange={(e) => setEditDistractors(e.target.value)}
                            placeholder="Opcional: 3 distractores separados por coma"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[#0b2b36] border border-white/15 text-slate-300 text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => savePhotoEdit(photo.id)}
                            className="w-full py-1.5 rounded-lg bg-[#84bd00] text-[#002b36] font-black text-xs flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" /> Guardar
                          </button>
                        </div>
                      ) : (
                        <>
                          <div>
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="font-black text-white text-base truncate">
                                {photo.name}
                              </h3>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEditingPhoto(photo);
                                }}
                                className="p-1 text-slate-400 hover:text-white"
                                title="Editar nombre, pista u opciones"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            {photo.hint && (
                              <p className="text-[11px] text-[#e5a93c] truncate mt-0.5 font-semibold">
                                💡 Pista: {photo.hint}
                              </p>
                            )}
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">
                              {photo.customDistractors?.length > 0
                                ? `Distractores: ${photo.customDistractors.join(', ')}`
                                : 'Distractores: Automáticos del lote'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhotoId(photo.id);
                              setScrubberVal(null);
                              sendAction('START_ROUND', {
                                photoId: photo.id,
                                durationSeconds: settings.timerDuration || 15,
                                effectType: settings.effectType || 'SWIRL_BLUR',
                                pointsMultiplier: settings.pointsMultiplier || 1,
                              });
                            }}
                            className="mt-3 w-full py-2 rounded-xl bg-[#008296]/30 hover:bg-[#008296] text-[#00b4cc] hover:text-white font-black text-xs transition flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            LANZAR ESTA FOTO
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN (4 cols): Live Leaderboard & Player Moderation */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-[#0b2b36] border border-[#008296]/40 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00b4cc]" />
                <h2 className="font-black text-base text-white">
                  Jugadores ({players.length})
                </h2>
              </div>

              <button
                onClick={() => {
                  if (confirm('¿Reiniciar todos los puntajes a 0?')) {
                    sendAction('RESET_SCORES');
                  }
                }}
                className="px-2.5 py-1.5 rounded-xl bg-[#071e26] hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center gap-1 border border-white/10"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Pts
              </button>
            </div>

            {players.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-[#071e26]/60 border border-white/5 text-slate-400 text-sm">
                Esperando que los espectadores escaneen el código QR en{' '}
                <code className="text-[#00b4cc]">/tv</code>.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {players.map((p, idx) => {
                  const answeredThisRound =
                    round && p.lastAnswer?.roundId === round.roundId;
                  const isFastest = round?.fastestWinner?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-[#071e26] border border-white/10"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-[#0b2b36] text-[#e5a93c] font-black text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{
                            backgroundColor: p.avatarColor || '#008296',
                          }}
                        />
                        <div className="truncate">
                          <div className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isFastest && (
                              <span className="px-1.5 py-0.2 rounded bg-[#e5a93c] text-[#002b36] text-[10px] font-black flex items-center gap-0.5">
                                <Zap className="w-2.5 h-2.5 fill-current" /> 1°
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-semibold">
                            {p.score.toLocaleString()} pts
                            {answeredThisRound && (
                              <span className="ml-2 text-[#84bd00]">
                                ● Votó ({round.options?.[p.lastAnswer.optionIndex]}) en{' '}
                                {(p.lastAnswer.elapsedMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() =>
                          sendAction('KICK_PLAYER', { playerId: p.id })
                        }
                        className="p-1.5 text-slate-500 hover:text-rose-400 transition"
                        title="Expulsar jugador"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
