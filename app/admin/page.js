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
} from 'lucide-react';
import DistortedCanvas from '@/components/DistortedCanvas';

const EFFECT_OPTIONS = [
  { id: 'SWIRL_BLUR', label: 'Remolino + Blur (Deformado)' },
  { id: 'PIXELATE', label: 'Pixelado Retro' },
  { id: 'BLUR', label: 'Difuminado Intenso' },
  { id: 'ZOOM', label: 'Zoom Extremo al Centro' },
];

const TIMER_PRESETS = [10, 15, 20, 30, 45];

// Helper to compress and resize uploaded photos on the client before sending
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

        // Square crop center for consistent faces
        const minSide = Math.min(width, height);
        const sx = (width - minSide) / 2;
        const sy = (height - minSide) / 2;

        canvas.width = MAX_SIZE;
        canvas.height = MAX_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, MAX_SIZE, MAX_SIZE);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        // Clean filename without extension
        const rawName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
        resolve({
          name: formattedName || 'Personaje',
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
  const [editDistractors, setEditDistractors] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

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
          const nextUnplayed = data.photos.find((p) => !p.played) || data.photos[0];
          setSelectedPhotoId(nextUnplayed.id);
        }
      } catch (e) {}
    }

    pollAdmin();
    const interval = setInterval(pollAdmin, 650);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [selectedPhotoId]);

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
      const filesArray = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
      const processed = [];
      for (const file of filesArray) {
        const item = await compressImageFile(file);
        processed.push(item);
      }
      if (processed.length > 0) {
        const updated = await sendAction('ADD_PHOTOS_BATCH', { photos: processed });
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
      customDistractors: distractorsArray,
    });
    setEditingPhotoId(null);
  }

  async function handleStartNextUnplayed() {
    if (!gameState?.photos?.length) return;
    const nextPhoto =
      gameState.photos.find((p) => !p.played && p.id !== gameState.activeRound?.photoId) ||
      gameState.photos.find((p) => !p.played) ||
      gameState.photos[0];
    if (nextPhoto) {
      setSelectedPhotoId(nextPhoto.id);
      await sendAction('START_ROUND', {
        photoId: nextPhoto.id,
        durationSeconds: gameState.settings?.timerDuration || 15,
        effectType: gameState.settings?.effectType || 'SWIRL_BLUR',
      });
    }
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">
        Cargando Panel de Director...
      </div>
    );
  }

  const phase = gameState.phase;
  const round = gameState.activeRound;
  const settings = gameState.settings || {};
  const photos = gameState.photos || [];
  const players = gameState.allPlayers || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      {/* Top Broadcast Header */}
      <header className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-white/10 rounded-3xl px-6 py-4 mb-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping" />
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">
              DIRECTOR DE STREAMING — ¿QUIÉN ES?
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Control en tiempo real de TV, Jugadores y Lote de Fotos
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href="/tv"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600/20 border border-indigo-400/40 text-indigo-300 hover:bg-indigo-600/30 font-bold text-xs transition"
          >
            <Tv className="w-4 h-4" />
            Abrir Pantalla TV (/tv)
          </a>
          <a
            href="/play"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-fuchsia-600/20 border border-fuchsia-400/40 text-fuchsia-300 hover:bg-fuchsia-600/30 font-bold text-xs transition"
          >
            <Smartphone className="w-4 h-4" />
            Abrir Vista Jugador (/play)
          </a>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (7 cols): Live Show Controls & Photo Batch Manager */}
        <div className="lg:col-span-8 space-y-6">
          {/* 1. LIVE SWITCHER DECK */}
          <section className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-400" />
                Escena en Pantalla TV
              </h2>
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs font-black">
                ESTADO ACTUAL: {phase}
              </span>
            </div>

            {/* Scene Switcher Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <button
                onClick={() => sendAction('SET_PHASE', { phase: 'LOBBY' })}
                className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-sm border transition ${
                  phase === 'LOBBY'
                    ? 'bg-indigo-600 border-indigo-300 text-white shadow-lg'
                    : 'bg-slate-800/80 border-white/10 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <QrCode className="w-4 h-4" />
                LOBBY QR
              </button>

              <button
                onClick={() =>
                  sendAction('START_ROUND', {
                    photoId: selectedPhotoId,
                    durationSeconds: settings.timerDuration || 15,
                    effectType: settings.effectType || 'SWIRL_BLUR',
                  })
                }
                className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-300/50 text-white shadow-lg transition"
              >
                <Play className="w-4 h-4 fill-white" />
                LANZAR FOTO
              </button>

              <button
                onClick={() => sendAction('REVEAL_NOW')}
                disabled={!round}
                className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-sm border transition ${
                  phase === 'REVEALED'
                    ? 'bg-amber-500 border-amber-200 text-black'
                    : 'bg-slate-800/80 border-white/10 text-amber-300 hover:bg-slate-800 disabled:opacity-40'
                }`}
              >
                <Eye className="w-4 h-4" />
                REVELAR YA
              </button>

              <button
                onClick={() => sendAction('SET_PHASE', { phase: 'RANKING' })}
                className={`flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black text-sm border transition ${
                  phase === 'RANKING'
                    ? 'bg-amber-500 border-amber-200 text-black shadow-lg'
                    : 'bg-slate-800/80 border-white/10 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-400" />
                VER RANKING
              </button>
            </div>

            {/* Active Round Monitor Bar */}
            {round && (
              <div className="bg-slate-950 border border-white/10 rounded-2xl p-4 mb-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/15 shrink-0">
                    <DistortedCanvas
                      imageSrc={round.imageData}
                      progress={round.progress}
                      effectType={round.effectType}
                      isRevealed={phase === 'REVEALED'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-400 uppercase">
                      En el Aire: {round.correctName}
                    </div>
                    <div className="text-lg font-black text-white">
                      {phase === 'PLAYING'
                        ? `Tiempo restante: ${Math.ceil((round.remainingMs || 0) / 1000)}s`
                        : '¡Imagen Revelada!'}
                    </div>
                    <div className="text-xs text-slate-400 font-semibold">
                      Votos recibidos: {round.totalVotes || 0} de {players.length} jugadores
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {phase === 'PLAYING' && (
                    <button
                      onClick={() => sendAction('TOGGLE_PAUSE')}
                      className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs border ${
                        round.isPaused
                          ? 'bg-amber-500 text-black border-amber-300'
                          : 'bg-slate-800 text-white border-white/15'
                      }`}
                    >
                      {round.isPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5 fill-black" /> REANUDAR TIMER
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" /> CONGELAR EFECTO
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={handleStartNextUnplayed}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    SIGUIENTE FOTO
                  </button>
                </div>
              </div>
            )}

            {/* Quick Round Settings (Effect Type, Timer Duration, TV Overlay Options) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-white/10">
              {/* Effect selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                  Efecto de Distorsión
                </label>
                <select
                  value={settings.effectType || 'SWIRL_BLUR'}
                  onChange={(e) =>
                    sendAction('UPDATE_SETTINGS', {
                      settings: { effectType: e.target.value },
                    })
                  }
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-sm font-bold text-white"
                >
                  {EFFECT_OPTIONS.map((ef) => (
                    <option key={ef.id} value={ef.id}>
                      {ef.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Timer presets */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                  Duración del Timer
                </label>
                <div className="flex items-center gap-1.5">
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
                          ? 'bg-indigo-600 border-indigo-400 text-white'
                          : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Studio / OBS Chroma & Audio toggles */}
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1.5">
                  Opciones de TV / OBS
                </label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      sendAction('UPDATE_SETTINGS', {
                        settings: { showQrOnTv: !settings.showQrOnTv },
                      })
                    }
                    className={`flex-1 py-2 px-2.5 rounded-xl font-bold text-xs border flex items-center justify-center gap-1 ${
                      settings.showQrOnTv
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                        : 'bg-slate-950 border-white/10 text-slate-500'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    QR {settings.showQrOnTv ? 'ON' : 'OFF'}
                  </button>

                  <button
                    onClick={() =>
                      sendAction('UPDATE_SETTINGS', {
                        settings: { soundEnabled: !settings.soundEnabled },
                      })
                    }
                    className={`py-2 px-3 rounded-xl font-bold text-xs border flex items-center justify-center ${
                      settings.soundEnabled
                        ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-300'
                        : 'bg-slate-950 border-white/10 text-slate-500'
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
                    className="py-2 px-2.5 rounded-xl bg-slate-950 border border-white/15 text-xs font-bold text-white"
                    title="Fondo de TV"
                  >
                    <option value="DARK">Fondo Oscuro</option>
                    <option value="TRANSPARENT">OBS Transparente</option>
                    <option value="GREEN">Chroma Verde</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* 2. BATCH PHOTO UPLOADER & THUMBNAIL QUEUE */}
          <section className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-fuchsia-400" />
                  Lote de Fotos Cargadas ({photos.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Sube varias fotos a la vez. El nombre de cada archivo será la respuesta correcta y los distractores se crean solos.
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
                  ? 'border-indigo-400 bg-indigo-500/15'
                  : 'border-white/15 hover:border-indigo-400/60 bg-slate-950/60'
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
              <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <div className="font-extrabold text-sm text-white">
                {uploading
                  ? 'Procesando y optimizando lote de fotos...'
                  : 'Arrastra aquí tus fotos en lote o haz clic para seleccionar'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Tip: Si el archivo se llama <code className="text-indigo-300">Shakira.jpg</code>, la respuesta será &quot;Shakira&quot; automáticamente.
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
                    className={`group relative rounded-2xl overflow-hidden border-2 transition cursor-pointer flex flex-col justify-between bg-slate-950 ${
                      isOnAir
                        ? 'border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
                        : isSelected
                        ? 'border-indigo-500'
                        : 'border-white/10 hover:border-white/25'
                    }`}
                  >
                    {/* Top Image Preview */}
                    <div className="relative h-40 w-full bg-slate-900 overflow-hidden">
                      <img
                        src={photo.imageData}
                        alt={photo.name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md text-white font-black text-xs">
                          #{index + 1}
                        </span>
                        {isOnAir && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-black font-black text-xs">
                            EN AIRE
                          </span>
                        )}
                        {!isOnAir && photo.played && (
                          <span className="px-2.5 py-0.5 rounded-full bg-slate-800/90 text-slate-300 font-bold text-xs">
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

                    {/* Photo Details / Quick Editor */}
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
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-indigo-400 text-white text-xs font-bold"
                          />
                          <input
                            type="text"
                            value={editDistractors}
                            onChange={(e) => setEditDistractors(e.target.value)}
                            placeholder="Opcional: 3 distractores separados por coma"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-slate-300 text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => savePhotoEdit(photo.id)}
                            className="w-full py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1"
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
                                title="Editar nombre u opciones"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
                              sendAction('START_ROUND', {
                                photoId: photo.id,
                                durationSeconds: settings.timerDuration || 15,
                                effectType: settings.effectType || 'SWIRL_BLUR',
                              });
                            }}
                            className="mt-3 w-full py-2 rounded-xl bg-indigo-600/25 hover:bg-indigo-600 text-indigo-200 hover:text-white font-black text-xs transition flex items-center justify-center gap-1.5"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            LANZAR AHORA
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
          <section className="bg-slate-900 border border-white/10 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <h2 className="font-black text-base text-white">
                  Jugadores ({players.length})
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (confirm('¿Reiniciar todos los puntajes a 0?')) {
                      sendAction('RESET_SCORES');
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs flex items-center gap-1"
                  title="Reiniciar puntos a 0"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset Pts
                </button>
              </div>
            </div>

            {players.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl bg-slate-950/60 border border-white/5 text-slate-400 text-sm">
                Nadie se ha unido aún. Muestra el Lobby en <code className="text-indigo-300">/tv</code> o abre <code className="text-fuchsia-300">/play</code> para probar.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {players.map((p, idx) => {
                  const answeredThisRound =
                    round && p.lastAnswer?.roundId === round.roundId;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-white/10"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 font-black text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: p.avatarColor || '#6366f1' }}
                        />
                        <div className="truncate">
                          <div className="font-bold text-sm text-white truncate">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-semibold">
                            {p.score.toLocaleString()} pts
                            {answeredThisRound && (
                              <span className="ml-2 text-emerald-400">● Respondió</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => sendAction('KICK_PLAYER', { playerId: p.id })}
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
