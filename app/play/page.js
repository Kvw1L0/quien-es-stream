'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Flame, CheckCircle2, XCircle, Clock, Sparkles, Lock } from 'lucide-react';
import DistortedCanvas from '@/components/DistortedCanvas';

const AVATAR_COLORS = [
  '#008296',
  '#e59a24',
  '#84bd00',
  '#ff5500',
  '#005566',
  '#00b4cc',
];

const OPTION_STYLES = [
  {
    label: 'A',
    bg: 'bg-[#008296] active:bg-[#00697a]',
    border: 'border-[#005566]',
  },
  {
    label: 'B',
    bg: 'bg-[#e59a24] active:bg-[#cc8414]',
    border: 'border-[#b8740a]',
  },
  {
    label: 'C',
    bg: 'bg-[#73a900] active:bg-[#5e8a00]',
    border: 'border-[#527800]',
  },
  {
    label: 'D',
    bg: 'bg-[#ff5500] active:bg-[#e04800]',
    border: 'border-[#c43e00]',
  },
];

export default function MobilePlayerPage() {
  const [playerId, setPlayerId] = useState(null);
  const [nickname, setNickname] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [isJoined, setIsJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  const [gameState, setGameState] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [smoothRemainingSec, setSmoothRemainingSec] = useState(0);

  const syncSnapshotRef = useRef({
    progress: 0,
    remainingMs: 0,
    durationMs: 15000,
    isPaused: false,
    syncedAt: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let storedId = localStorage.getItem('quienes_player_id');
    const storedName = localStorage.getItem('quienes_player_name');
    const storedColor = localStorage.getItem('quienes_player_color');

    if (!storedId) {
      storedId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem('quienes_player_id', storedId);
    }
    setPlayerId(storedId);
    if (storedName) setNickname(storedName);
    if (storedColor) setSelectedColor(storedColor);
  }, []);

  useEffect(() => {
    if (!playerId) return;
    let active = true;

    async function poll() {
      try {
        const res = await fetch(
          `/api/game?role=player&playerId=${encodeURIComponent(playerId)}`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        setGameState(data);
        if (data.me) {
          setIsJoined(true);
        }

        if (data.activeRound) {
          syncSnapshotRef.current = {
            progress: data.activeRound.progress || 0,
            remainingMs: data.activeRound.remainingMs || 0,
            durationMs: data.activeRound.durationMs || 15000,
            isPaused: Boolean(data.activeRound.isPaused),
            syncedAt: performance.now(),
          };
        }
      } catch (e) {}
    }

    poll();
    const interval = setInterval(poll, 500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [playerId]);

  useEffect(() => {
    let rafId;
    function tick() {
      if (gameState?.phase === 'PLAYING' && gameState?.activeRound) {
        const snap = syncSnapshotRef.current;
        if (snap.isPaused) {
          setSmoothProgress(snap.progress);
          setSmoothRemainingSec(Math.ceil(snap.remainingMs / 1000));
        } else {
          const delta = performance.now() - snap.syncedAt;
          const remMs = Math.max(0, snap.remainingMs - delta);
          const prog =
            snap.durationMs > 0 ? Math.min(1, 1 - remMs / snap.durationMs) : 1;
          setSmoothProgress(prog);
          setSmoothRemainingSec(Math.ceil(remMs / 1000));
        }
      } else if (gameState?.phase === 'REVEALED') {
        setSmoothProgress(1);
        setSmoothRemainingSec(0);
      }
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [gameState?.phase, gameState?.activeRound]);

  async function handleJoin(e) {
    e.preventDefault();
    if (!nickname.trim() || !playerId) return;
    setJoining(true);
    try {
      localStorage.setItem('quienes_player_name', nickname.trim());
      localStorage.setItem('quienes_player_color', selectedColor);

      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'JOIN_PLAYER',
          role: 'player',
          playerId,
          name: nickname.trim(),
          avatarColor: selectedColor,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGameState(data);
        setIsJoined(true);
      }
    } finally {
      setJoining(false);
    }
  }

  async function handleSelectOption(optionIndex) {
    if (submitting || !playerId || !gameState?.activeRound) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SUBMIT_ANSWER',
          role: 'player',
          playerId,
          optionIndex,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGameState(data);
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Screen 1: Nickname Registration
  if (!isJoined || !gameState?.me) {
    return (
      <main
        className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-cover bg-center"
        style={{ backgroundImage: "url('/key-visual-bg.jpg')" }}
      >
        <div className="w-full max-w-sm bg-white/95 backdrop-blur-md border-4 border-[#008296] rounded-3xl p-7 shadow-2xl">
          <div className="text-center mb-6">
            <span className="inline-block px-4 py-1 rounded-full bg-[#008296] text-white font-extrabold text-xs uppercase tracking-wider mb-2">
              HOGAR DE CRISTO • EN VIVO
            </span>
            <h1 className="font-display text-4xl font-black text-[#005566] uppercase tracking-wide">
              ¿QUIÉN ES?
            </h1>
          </div>

          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#005566] mb-2">
                Tu Nombre o Apodo
              </label>
              <input
                type="text"
                maxLength={18}
                required
                placeholder="Ej. Camila"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-[#f6f0e6] border-2 border-[#008296]/40 text-[#005566] font-extrabold text-lg focus:outline-none focus:border-[#008296]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#005566] mb-2">
                Color
              </label>
              <div className="flex items-center justify-between gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-10 h-10 rounded-full transition-transform ${
                      selectedColor === color
                        ? 'scale-125 ring-2 ring-[#005566] ring-offset-2'
                        : 'opacity-75'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={joining || !nickname.trim()}
              className="w-full py-4 rounded-2xl bg-[#008296] hover:bg-[#006b7d] text-white font-display font-black text-2xl uppercase tracking-wider shadow-lg active:scale-98 disabled:opacity-50"
            >
              {joining ? 'CONECTANDO...' : 'ENTRAR A JUGAR'}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const me = gameState.me;
  const phase = gameState.phase;
  const round = gameState.activeRound;
  const myCurrentRoundAnswer =
    round && me.lastAnswer?.roundId === round.roundId ? me.lastAnswer : null;
  const isTimeUp = phase === 'PLAYING' && smoothRemainingSec <= 0;

  return (
    <main
      className="min-h-screen w-full flex flex-col justify-between p-4 pb-8 max-w-md mx-auto select-none bg-cover bg-center"
      style={{ backgroundImage: "url('/key-visual-bg.jpg')" }}
    >
      {/* Top Player Status Bar */}
      <header className="flex items-center justify-between bg-white/95 backdrop-blur-md border-2 border-[#008296] px-4 py-3 rounded-2xl shadow-lg">
        <div className="flex items-center gap-2.5">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ backgroundColor: me.avatarColor || '#008296' }}
          />
          <span className="font-display font-black text-[#005566] text-xl uppercase truncate max-w-[135px]">
            {me.name}
          </span>
          {me.streak >= 2 && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-[#ff5500] text-white text-xs font-black">
              <Flame className="w-3 h-3 fill-white" />x{me.streak}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-[#008296] font-extrabold block leading-none">
              PUNTOS
            </span>
            <span className="font-display font-black text-[#005566] text-2xl leading-tight">
              {me.score.toLocaleString()}
            </span>
          </div>
          <div className="px-3 py-1 rounded-xl bg-[#008296] text-white font-display font-black text-lg">
            #{me.rank}
          </div>
        </div>
      </header>

      {/* ================= LOBBY STATE ================= */}
      {phase === 'LOBBY' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 my-6">
          <div className="bg-white/95 border-4 border-[#008296] rounded-3xl p-7 shadow-2xl w-full">
            <div className="w-16 h-16 rounded-2xl bg-[#008296]/15 flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Sparkles className="w-9 h-9 text-[#008296]" />
            </div>
            <h2 className="font-display text-3xl font-black text-[#005566] uppercase mb-1">
              ¡ESTÁS EN EL JUEGO!
            </h2>
            <p className="text-[#005566]/80 font-bold text-sm">
              Mira la pantalla principal, la próxima foto está por comenzar...
            </p>
          </div>
        </div>
      )}

      {/* ================= PLAYING, TIME-UP SUSPENSE OR REVEALED STATE ================= */}
      {(phase === 'PLAYING' || phase === 'REVEALED') && round && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 my-3">
          {/* Top Header Pill SEPARATED above the face frame so it never covers the portrait */}
          <div className="w-full flex justify-center">
            {phase === 'PLAYING' && !isTimeUp && (
              <div
                className={`px-6 py-1.5 rounded-full font-display font-black text-2xl uppercase tracking-wider border-2 shadow-md ${
                  smoothRemainingSec <= 5
                    ? 'bg-[#ff5500] border-white text-white animate-bounce'
                    : 'bg-[#005566] border-[#008296] text-white'
                }`}
              >
                TIEMPO: {smoothRemainingSec}s
              </div>
            )}

            {phase === 'PLAYING' && isTimeUp && (
              <div className="px-6 py-1.5 rounded-full bg-[#ff5500] border-2 border-white text-white font-display font-black text-2xl uppercase tracking-wider shadow-lg flex items-center gap-2">
                <Lock className="w-5 h-5" /> ¡TIEMPO CERRADO!
              </div>
            )}

            {phase === 'REVEALED' && (
              <div className="px-6 py-1.5 rounded-full bg-[#008296] border-2 border-[#e5a93c] text-white font-display font-black text-2xl uppercase tracking-wider shadow-lg">
                {round.correctName}
              </div>
            )}
          </div>

          {/* Synchronized Distorted Face on Mobile */}
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-3xl overflow-hidden border-4 border-[#008296] bg-white p-1.5 shadow-xl">
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#003d4a]">
              <DistortedCanvas
                imageSrc={round.imageData}
                progress={smoothProgress}
                effectType={round.effectType}
                isRevealed={phase === 'REVEALED'}
                className="w-full h-full object-cover"
              />
              {phase === 'PLAYING' && !isTimeUp && (
                <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/50">
                  <div
                    className="h-full bg-gradient-to-r from-[#00b4cc] to-[#84bd00]"
                    style={{
                      width: `${Math.max(0, (1 - smoothProgress) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* 1) PLAYING, Timer Running & Not Answered Yet -> Show 4 Big Option Buttons */}
          {phase === 'PLAYING' && !isTimeUp && !myCurrentRoundAnswer && (
            <div className="grid grid-cols-1 gap-2.5 w-full mt-1">
              {round.options?.map((optionText, idx) => {
                const style = OPTION_STYLES[idx % 4];
                return (
                  <button
                    key={idx}
                    disabled={submitting}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl ${style.bg} border-b-4 ${style.border} text-left shadow-lg active:scale-95 transition-transform`}
                  >
                    <span className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center font-display font-black text-2xl text-white shrink-0">
                      {style.label}
                    </span>
                    <span className="font-display font-black text-white text-2xl uppercase tracking-wide leading-tight">
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2) PLAYING & Player Already Voted (Waiting for timer & Admin manual reveal) */}
          {phase === 'PLAYING' && myCurrentRoundAnswer && (
            <div className="w-full bg-white/95 border-4 border-[#008296] rounded-3xl p-5 text-center shadow-xl">
              <Clock className="w-10 h-10 text-[#008296] mx-auto mb-1.5 animate-pulse" />
              <div className="font-display font-black text-2xl uppercase text-[#005566]">
                ¡VOTO REGISTRADO!
              </div>
              <div className="text-[#005566] text-sm font-bold mt-1">
                Tu elección:{' '}
                <span className="text-[#008296] font-extrabold uppercase">
                  {round.options?.[myCurrentRoundAnswer.optionIndex]}
                </span>
              </div>
              <div className="mt-2 px-3 py-1 rounded-full bg-[#f6f0e6] inline-block text-xs text-[#005566] font-extrabold">
                Atento a la pantalla para la revelación...
              </div>
            </div>
          )}

          {/* 3) PLAYING & Timer Reached 0 without Player Answering */}
          {phase === 'PLAYING' && isTimeUp && !myCurrentRoundAnswer && (
            <div className="w-full bg-white/95 border-4 border-[#ff5500] rounded-3xl p-5 text-center shadow-xl">
              <Lock className="w-10 h-10 text-[#ff5500] mx-auto mb-1.5" />
              <div className="font-display font-black text-2xl uppercase text-[#005566]">
                ¡SE ACABÓ EL TIEMPO!
              </div>
              <div className="text-[#005566]/80 text-xs font-bold mt-1">
                Mira la pantalla principal para descubrir quién es el personaje...
              </div>
            </div>
          )}

          {/* 4) REVEALED: Admin manually released the result! Now show on phones whether they won */}
          {phase === 'REVEALED' && (
            <div
              className={`w-full rounded-3xl p-5 text-center border-4 shadow-2xl ${
                myCurrentRoundAnswer?.isCorrect
                  ? 'bg-[#005566] border-[#84bd00] text-white'
                  : 'bg-white/95 border-[#ff5500] text-[#005566]'
              }`}
            >
              {myCurrentRoundAnswer?.isCorrect ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-[#84bd00] mx-auto mb-1" />
                  <div className="font-display font-black text-3xl uppercase">
                    ¡ACERTASTE!
                  </div>
                  <div className="font-display font-black text-4xl text-[#e5a93c] mt-0.5">
                    +{myCurrentRoundAnswer.pointsEarned} PTS
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 text-[#ff5500] mx-auto mb-1" />
                  <div className="font-display font-black text-3xl uppercase text-[#ff5500]">
                    {myCurrentRoundAnswer ? '¡NO ERA!' : '¡SIN RESPUESTA!'}
                  </div>
                  <div className="text-[#005566] text-base font-extrabold mt-1">
                    Respuesta: <span className="text-[#008296] uppercase">{round.correctName}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================= RANKING STATE ================= */}
      {phase === 'RANKING' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center my-6">
          <div className="w-full bg-white/95 border-4 border-[#e5a93c] rounded-3xl p-6 shadow-2xl">
            <Trophy className="w-14 h-14 text-[#e5a93c] mx-auto mb-2" />
            <div className="text-xs font-extrabold uppercase tracking-widest text-[#008296]">
              TU POSICIÓN EN EL RANKING
            </div>
            <div className="font-display text-7xl font-black text-[#005566] my-1">
              #{me.rank}
            </div>
            <div className="font-display text-3xl font-black text-[#008296]">
              {me.score.toLocaleString()} PTS
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-[11px] text-[#005566] font-extrabold bg-white/75 backdrop-blur-sm py-1 px-3 rounded-full mx-auto">
        HOGAR DE CRISTO • SHOW EN VIVO
      </footer>
    </main>
  );
}
