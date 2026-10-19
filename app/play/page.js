'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Trophy, Flame, CheckCircle2, XCircle, Clock, Sparkles } from 'lucide-react';
import DistortedCanvas from '@/components/DistortedCanvas';

const AVATAR_COLORS = [
  '#6366f1',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#8b5cf6',
  '#f43f5e',
];

const OPTION_STYLES = [
  { label: 'A', bg: 'from-rose-600 to-rose-700 active:from-rose-700', border: 'border-rose-400/50' },
  { label: 'B', bg: 'from-sky-600 to-sky-700 active:from-sky-700', border: 'border-sky-400/50' },
  { label: 'C', bg: 'from-amber-500 to-amber-600 active:from-amber-600', border: 'border-amber-300/50' },
  { label: 'D', bg: 'from-emerald-600 to-emerald-700 active:from-emerald-700', border: 'border-emerald-400/50' },
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

  // Restore player session from localStorage
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

  // Poll game state
  useEffect(() => {
    if (!playerId) return;
    let active = true;

    async function poll() {
      try {
        const res = await fetch(`/api/game?role=player&playerId=${encodeURIComponent(playerId)}`, {
          cache: 'no-store',
        });
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
    const interval = setInterval(poll, 550);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [playerId]);

  // Smooth local timer & canvas interpolation
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
          const prog = snap.durationMs > 0 ? Math.min(1, 1 - remMs / snap.durationMs) : 1;
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
      <main className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-3xl p-7 shadow-2xl">
          <div className="text-center mb-6">
            <span className="inline-block px-3.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs uppercase tracking-wider mb-2">
              EN VIVO
            </span>
            <h1 className="text-3xl font-black text-white tracking-tight">¿QUIÉN ES?</h1>
          </div>

          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Tu Apodo / Nickname
              </label>
              <input
                type="text"
                maxLength={18}
                required
                placeholder="Ej. SebaStream"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-white/15 text-white font-bold text-lg focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                Color
              </label>
              <div className="flex items-center justify-between gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-9 h-9 rounded-full transition-transform ${
                      selectedColor === color
                        ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900'
                        : 'opacity-70'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={joining || !nickname.trim()}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white font-black text-lg shadow-lg active:scale-98 disabled:opacity-50"
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

  return (
    <main className="min-h-screen w-full bg-slate-950 flex flex-col justify-between p-4 pb-6 max-w-md mx-auto select-none">
      {/* Top Player Status Bar */}
      <header className="flex items-center justify-between bg-slate-900/90 border border-white/10 px-4 py-3 rounded-2xl shadow-md">
        <div className="flex items-center gap-2.5">
          <span
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ backgroundColor: me.avatarColor || '#6366f1' }}
          />
          <span className="font-extrabold text-white text-base truncate max-w-[130px]">
            {me.name}
          </span>
          {me.streak >= 2 && (
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 text-xs font-black">
              <Flame className="w-3 h-3 fill-orange-400" />x{me.streak}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs text-slate-400 font-bold block leading-none">PUNTOS</span>
            <span className="font-black text-amber-400 text-lg leading-tight">
              {me.score.toLocaleString()}
            </span>
          </div>
          <div className="px-2.5 py-1 rounded-xl bg-slate-800 text-white font-black text-sm">
            #{me.rank}
          </div>
        </div>
      </header>

      {/* ================= LOBBY STATE ================= */}
      {phase === 'LOBBY' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 my-8">
          <div className="w-20 h-20 rounded-3xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center mb-5 animate-pulse">
            <Sparkles className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">¡ESTÁS DENTRO!</h2>
          <p className="text-slate-400 font-medium text-sm">
            Atento a la pantalla, la siguiente foto está por aparecer...
          </p>
        </div>
      )}

      {/* ================= PLAYING OR REVEALED STATE ================= */}
      {(phase === 'PLAYING' || phase === 'REVEALED') && round && (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 my-3">
          {/* Synchronized Distorted Face on Mobile */}
          <div className="relative flex flex-col items-center w-full">
            {phase === 'PLAYING' && (
              <div
                className={`-mb-4 z-10 px-5 py-1 rounded-full font-black text-lg border shadow-lg ${
                  smoothRemainingSec <= 5
                    ? 'bg-rose-600 border-rose-300 text-white animate-bounce'
                    : 'bg-slate-900 border-indigo-400/40 text-white'
                }`}
              >
                {smoothRemainingSec}s
              </div>
            )}

            {phase === 'REVEALED' && (
              <div className="-mb-4 z-10 px-5 py-1 rounded-full bg-emerald-600 border border-emerald-300 text-white font-black text-lg shadow-lg">
                {round.correctName}
              </div>
            )}

            <div className="relative w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border-2 border-white/15 bg-slate-900 shadow-2xl">
              <DistortedCanvas
                imageSrc={round.imageData}
                progress={smoothProgress}
                effectType={round.effectType}
                isRevealed={phase === 'REVEALED'}
                className="w-full h-full object-cover"
              />
              {phase === 'PLAYING' && (
                <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/60">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
                    style={{ width: `${Math.max(0, (1 - smoothProgress) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* If PLAYING and player hasn't answered yet -> Show 4 Big Option Buttons */}
          {phase === 'PLAYING' && !myCurrentRoundAnswer && (
            <div className="grid grid-cols-1 gap-2.5 w-full mt-1">
              {round.options?.map((optionText, idx) => {
                const style = OPTION_STYLES[idx % 4];
                return (
                  <button
                    key={idx}
                    disabled={submitting}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl bg-gradient-to-r ${style.bg} border ${style.border} text-left shadow-lg active:scale-95 transition-transform`}
                  >
                    <span className="w-9 h-9 rounded-xl bg-black/25 flex items-center justify-center font-black text-lg text-white shrink-0">
                      {style.label}
                    </span>
                    <span className="font-extrabold text-white text-lg leading-tight">
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* If PLAYING and player already locked in their answer */}
          {phase === 'PLAYING' && myCurrentRoundAnswer && (
            <div className="w-full bg-slate-900/90 border border-indigo-500/30 rounded-3xl p-6 text-center shadow-xl">
              <Clock className="w-10 h-10 text-indigo-400 mx-auto mb-2 animate-spin" />
              <div className="font-black text-xl text-white">¡RESPUESTA ENVIADA!</div>
              <div className="text-slate-400 text-sm font-semibold mt-1">
                Elegiste:{' '}
                <span className="text-indigo-300 font-bold">
                  {round.options?.[myCurrentRoundAnswer.optionIndex]}
                </span>
              </div>
              <div className="mt-2 text-xs text-slate-500 font-bold">
                Tiempo: {(myCurrentRoundAnswer.elapsedMs / 1000).toFixed(2)}s — Esperando revelación...
              </div>
            </div>
          )}

          {/* If REVEALED -> Show instant result feedback */}
          {phase === 'REVEALED' && (
            <div
              className={`w-full rounded-3xl p-5 text-center border-2 shadow-xl ${
                myCurrentRoundAnswer?.isCorrect
                  ? 'bg-emerald-950/90 border-emerald-400'
                  : 'bg-rose-950/90 border-rose-400'
              }`}
            >
              {myCurrentRoundAnswer?.isCorrect ? (
                <>
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-1" />
                  <div className="font-black text-2xl text-white">¡ACERTASTE!</div>
                  <div className="font-black text-3xl text-amber-300 mt-1">
                    +{myCurrentRoundAnswer.pointsEarned} PTS
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-12 h-12 text-rose-400 mx-auto mb-1" />
                  <div className="font-black text-2xl text-white">
                    {myCurrentRoundAnswer ? '¡INCORRECTO!' : '¡TIEMPO AGOTADO!'}
                  </div>
                  <div className="text-rose-200 text-sm font-bold mt-1">
                    Era: {round.correctName}
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
          <div className="w-full bg-slate-900 border border-amber-400/30 rounded-3xl p-6 shadow-2xl">
            <Trophy className="w-14 h-14 text-amber-400 mx-auto mb-2" />
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
              TU POSICIÓN ACTUAL
            </div>
            <div className="text-6xl font-black text-white my-2">#{me.rank}</div>
            <div className="text-2xl font-black text-amber-400">
              {me.score.toLocaleString()} PTS
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-[11px] text-slate-600 font-semibold">
        ¿QUIÉN ES? LIVE SHOW
      </footer>
    </main>
  );
}
