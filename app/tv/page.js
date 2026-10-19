'use client';

import React, { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Trophy, Users, Flame, CheckCircle2 } from 'lucide-react';
import DistortedCanvas from '@/components/DistortedCanvas';
import { soundFX } from '@/lib/soundEffects';

const OPTION_STYLES = [
  { label: 'A', bg: 'from-rose-600 to-rose-700', border: 'border-rose-400', bar: 'bg-rose-500' },
  { label: 'B', bg: 'from-sky-600 to-sky-700', border: 'border-sky-400', bar: 'bg-sky-500' },
  { label: 'C', bg: 'from-amber-500 to-amber-600', border: 'border-amber-300', bar: 'bg-amber-500' },
  { label: 'D', bg: 'from-emerald-600 to-emerald-700', border: 'border-emerald-400', bar: 'bg-emerald-500' },
];

export default function TvBroadcastPage() {
  const [gameState, setGameState] = useState(null);
  const [joinUrl, setJoinUrl] = useState('');
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [smoothRemainingSec, setSmoothRemainingSec] = useState(0);

  const prevPhaseRef = useRef(null);
  const prevSecRef = useRef(null);
  const syncSnapshotRef = useRef({
    progress: 0,
    remainingMs: 0,
    durationMs: 15000,
    isPaused: false,
    syncedAt: Date.now(),
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setJoinUrl(`${window.location.origin}/play`);
    }
  }, []);

  // Poll server state every 500ms
  useEffect(() => {
    let active = true;
    async function fetchState() {
      try {
        const res = await fetch('/api/game?role=tv', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        setGameState(data);

        if (data.settings?.customJoinUrl?.trim()) {
          setJoinUrl(data.settings.customJoinUrl.trim());
        } else if (typeof window !== 'undefined') {
          setJoinUrl(`${window.location.origin}/play`);
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

    fetchState();
    const interval = setInterval(fetchState, 500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  // 60fps local interpolation for ultra-smooth timer bar & canvas un-blurring
  useEffect(() => {
    let rafId;
    function updateLoop() {
      if (gameState?.phase === 'PLAYING' && gameState?.activeRound) {
        const snap = syncSnapshotRef.current;
        if (snap.isPaused) {
          setSmoothProgress(snap.progress);
          setSmoothRemainingSec(Math.ceil(snap.remainingMs / 1000));
        } else {
          const delta = performance.now() - snap.syncedAt;
          const remMs = Math.max(0, snap.remainingMs - delta);
          const prog = snap.durationMs > 0
            ? Math.min(1, 1 - remMs / snap.durationMs)
            : 1;
          setSmoothProgress(prog);
          const sec = Math.ceil(remMs / 1000);
          setSmoothRemainingSec(sec);

          // Trigger countdown ticks in last 5 seconds
          if (
            gameState.settings?.soundEnabled &&
            sec > 0 &&
            sec <= 5 &&
            prevSecRef.current !== sec
          ) {
            prevSecRef.current = sec;
            soundFX.playTick(sec <= 2);
          }
        }
      } else if (gameState?.phase === 'REVEALED') {
        setSmoothProgress(1);
        setSmoothRemainingSec(0);
      }
      rafId = requestAnimationFrame(updateLoop);
    }
    rafId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(rafId);
  }, [gameState?.phase, gameState?.activeRound, gameState?.settings?.soundEnabled]);

  // Trigger confetti & SFX on phase transitions
  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    const curr = gameState.phase;
    if (prev && prev !== curr) {
      if (curr === 'REVEALED') {
        if (gameState.settings?.soundEnabled) soundFX.playReveal();
        confetti({
          particleCount: 90,
          spread: 75,
          origin: { y: 0.6 },
        });
      } else if (curr === 'RANKING') {
        if (gameState.settings?.soundEnabled) soundFX.playPodium();
        confetti({
          particleCount: 130,
          spread: 100,
          origin: { y: 0.5 },
        });
      }
    }
    prevPhaseRef.current = curr;
  }, [gameState?.phase, gameState?.settings?.soundEnabled]);

  if (!gameState) {
    return <div className="min-h-screen w-screen bg-transparent" />;
  }

  const chromaMode = gameState.settings?.chromaMode || 'DARK';
  const bgClass =
    chromaMode === 'TRANSPARENT'
      ? 'bg-transparent'
      : chromaMode === 'GREEN'
      ? 'bg-[#00ff00]'
      : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-950 to-black';

  const phase = gameState.phase;
  const round = gameState.activeRound;
  const showQr = gameState.settings?.showQrOnTv !== false;

  return (
    <main
      onClick={() => soundFX.init()}
      className={`relative min-h-screen w-screen overflow-hidden flex items-center justify-center select-none ${bgClass}`}
    >
      {/* Ambient studio glow when in DARK mode */}
      {chromaMode === 'DARK' && (
        <>
          <div className="pointer-events-none absolute -top-40 -left-40 w-[36rem] h-[36rem] rounded-full bg-indigo-600/20 blur-[130px]" />
          <div className="pointer-events-none absolute -bottom-40 -right-40 w-[36rem] h-[36rem] rounded-full bg-fuchsia-600/20 blur-[130px]" />
        </>
      )}

      {/* Floating Corner QR Widget (during PLAYING / REVEALED / RANKING) */}
      {showQr && phase !== 'LOBBY' && joinUrl && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-4 bg-slate-900/90 backdrop-blur-xl border border-white/15 p-3.5 rounded-3xl shadow-2xl">
          <div className="bg-white p-2 rounded-2xl">
            <QRCodeSVG value={joinUrl} size={96} level="M" />
          </div>
          <div className="pr-3">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm uppercase tracking-wider">
              <Users className="w-4 h-4" />
              <span>{gameState.playerCount || 0} en vivo</span>
            </div>
            <p className="text-white font-black text-xl tracking-tight leading-tight mt-0.5">
              ¡ÚNETE AL JUEGO!
            </p>
          </div>
        </div>
      )}

      {/* ================= PHASE 1: LOBBY ================= */}
      {phase === 'LOBBY' && (
        <div className="z-10 flex flex-col items-center justify-center text-center px-6 max-w-4xl w-full">
          <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 font-bold text-lg mb-8 animate-pulse">
            <Users className="w-6 h-6" />
            <span>{gameState.playerCount || 0} JUGADORES CONECTADOS</span>
          </div>

          <h1 className="text-7xl md:text-8xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-fuchsia-300 drop-shadow-lg mb-10">
            ¿QUIÉN ES?
          </h1>

          {joinUrl && (
            <div className="bg-white p-7 rounded-[2.5rem] shadow-[0_0_80px_rgba(99,102,241,0.5)] border-8 border-indigo-500/30 animate-float">
              <QRCodeSVG value={joinUrl} size={280} level="M" />
            </div>
          )}

          {/* Connected player pills */}
          {gameState.leaderboard?.length > 0 && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3 max-w-3xl">
              {gameState.leaderboard.slice(0, 14).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-slate-900/85 border border-white/10 shadow-lg"
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full"
                    style={{ backgroundColor: p.avatarColor || '#6366f1' }}
                  />
                  <span className="font-bold text-white text-base">{p.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= PHASE 2 & 3: PLAYING & REVEALED ================= */}
      {(phase === 'PLAYING' || phase === 'REVEALED') && round && (
        <div className="z-10 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-14 w-full max-w-7xl px-8 py-6">
          {/* Left / Center: Giant Photo Frame + Countdown Bar */}
          <div className="relative flex flex-col items-center">
            {/* Floating Timer Pill */}
            {phase === 'PLAYING' && (
              <div
                className={` -mb-6 z-20 px-8 py-2.5 rounded-full font-black text-4xl tracking-wider shadow-2xl border-2 transition-colors ${
                  smoothRemainingSec <= 5
                    ? 'bg-rose-600 border-rose-300 text-white animate-bounce'
                    : 'bg-slate-900/95 border-indigo-400/50 text-white'
                }`}
              >
                {smoothRemainingSec}s
              </div>
            )}

            {/* Revealed Answer Banner */}
            {phase === 'REVEALED' && (
              <div className="-mb-6 z-20 px-9 py-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 border-2 border-emerald-200 text-white font-black text-3xl md:text-4xl tracking-tight shadow-[0_0_40px_rgba(16,185,129,0.7)]">
                {round.correctName}
              </div>
            )}

            {/* Main Canvas Container */}
            <div
              className={`relative w-[420px] h-[420px] md:w-[500px] md:h-[500px] rounded-[2.5rem] overflow-hidden shadow-[0_0_90px_rgba(0,0,0,0.85)] border-4 transition-all duration-500 bg-slate-900 ${
                phase === 'REVEALED'
                  ? 'border-emerald-400 shadow-[0_0_70px_rgba(16,185,129,0.45)] scale-[1.02]'
                  : smoothRemainingSec <= 5
                  ? 'border-rose-500 shadow-[0_0_70px_rgba(244,63,94,0.45)]'
                  : 'border-indigo-500/60'
              }`}
            >
              <DistortedCanvas
                imageSrc={round.imageData}
                progress={smoothProgress}
                effectType={round.effectType}
                isRevealed={phase === 'REVEALED'}
                className="w-full h-full object-cover"
              />

              {/* Progress Bar at the bottom of the photo */}
              {phase === 'PLAYING' && (
                <div className="absolute bottom-0 left-0 right-0 h-3.5 bg-black/60 backdrop-blur-sm">
                  <div
                    className={`h-full transition-none ${
                      smoothRemainingSec <= 5
                        ? 'bg-gradient-to-r from-rose-500 to-amber-500'
                        : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-fuchsia-500'
                    }`}
                    style={{ width: `${Math.max(0, (1 - smoothProgress) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right: 4 Options Cards + Live Vote Bars */}
          <div className="flex flex-col gap-4 w-full max-w-xl">
            {/* Live responses counter badge */}
            <div className="flex items-center justify-between px-2 mb-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-white/10 text-slate-300 font-bold text-sm">
                <Users className="w-4 h-4 text-indigo-400" />
                <span>{round.totalVotes || 0} VOTOS RECIBIDOS</span>
              </div>
            </div>

            {round.options?.map((optionText, idx) => {
              const style = OPTION_STYLES[idx % 4];
              const isCorrect = phase === 'REVEALED' && round.correctOptionIndex === idx;
              const isWrong = phase === 'REVEALED' && round.correctOptionIndex !== idx;

              const votesForOption = round.voteCounts ? round.voteCounts[idx] || 0 : 0;
              const votePercent =
                phase === 'REVEALED' && round.totalVotes > 0
                  ? Math.round((votesForOption / round.totalVotes) * 100)
                  : 0;

              return (
                <div
                  key={idx}
                  className={`relative overflow-hidden rounded-3xl border-2 p-5 transition-all duration-500 ${
                    isCorrect
                      ? 'bg-emerald-950/95 border-emerald-400 scale-105 shadow-[0_0_40px_rgba(16,185,129,0.5)]'
                      : isWrong
                      ? 'bg-slate-900/50 border-white/5 opacity-45 scale-95'
                      : 'bg-slate-900/90 border-white/15 shadow-xl'
                  }`}
                >
                  {/* Percentage fill bar when revealed */}
                  {phase === 'REVEALED' && (
                    <div
                      className={`absolute inset-y-0 left-0 opacity-25 transition-all duration-1000 ${
                        isCorrect ? 'bg-emerald-400' : style.bar
                      }`}
                      style={{ width: `${votePercent}%` }}
                    />
                  )}

                  <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${style.bg} flex items-center justify-center font-black text-2xl text-white shadow-md shrink-0`}
                      >
                        {style.label}
                      </div>
                      <span className="font-extrabold text-2xl md:text-3xl text-white tracking-tight">
                        {optionText}
                      </span>
                    </div>

                    {phase === 'REVEALED' && (
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-black text-2xl text-white/90">
                          {votePercent}%
                        </span>
                        {isCorrect && (
                          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= PHASE 4: RANKING / PODIUM ================= */}
      {phase === 'RANKING' && (
        <div className="z-10 flex flex-col items-center justify-center w-full max-w-4xl px-6 py-8">
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-black text-xl mb-6">
            <Trophy className="w-6 h-6 text-amber-400" />
            <span>RANKING EN VIVO</span>
          </div>

          <div className="w-full flex flex-col gap-3.5">
            {(!gameState.leaderboard || gameState.leaderboard.length === 0) && (
              <div className="text-center py-16 bg-slate-900/80 rounded-3xl border border-white/10 text-slate-400 text-2xl font-bold">
                Esperando jugadores...
              </div>
            )}

            {gameState.leaderboard?.slice(0, 8).map((player, idx) => {
              const isFirst = idx === 0;
              const isSecond = idx === 1;
              const isThird = idx === 2;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-7 py-4 rounded-3xl border-2 transition-all ${
                    isFirst
                      ? 'bg-gradient-to-r from-amber-500/25 via-slate-900/95 to-slate-900/95 border-amber-400 scale-[1.03] shadow-[0_0_40px_rgba(245,158,11,0.3)]'
                      : isSecond
                      ? 'bg-slate-900/90 border-slate-300/50'
                      : isThird
                      ? 'bg-slate-900/90 border-amber-700/60'
                      : 'bg-slate-900/75 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-2xl ${
                        isFirst
                          ? 'bg-amber-400 text-black'
                          : isSecond
                          ? 'bg-slate-300 text-black'
                          : isThird
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {idx + 1}
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className="w-4 h-4 rounded-full shrink-0"
                        style={{ backgroundColor: player.avatarColor || '#6366f1' }}
                      />
                      <span className="font-black text-2xl md:text-3xl text-white">
                        {player.name}
                      </span>
                      {player.streak >= 2 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-400/40 text-orange-300 text-xs font-extrabold">
                          <Flame className="w-3.5 h-3.5 fill-orange-400" />x{player.streak}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="font-black text-3xl text-amber-400 tracking-tight">
                    {player.score.toLocaleString()} <span className="text-base text-slate-400 font-bold">PTS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
