'use client';

import React, { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Users,
  Flame,
  CheckCircle2,
  Zap,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import DistortedCanvas from '@/components/DistortedCanvas';
import { soundFX } from '@/lib/soundEffects';

const OPTION_STYLES = [
  {
    label: 'A',
    badgeBg: 'bg-[#008296]',
    barFill: 'bg-[#008296]',
    border: 'border-[#008296]/30',
  },
  {
    label: 'B',
    badgeBg: 'bg-[#e59a24]',
    barFill: 'bg-[#e59a24]',
    border: 'border-[#e59a24]/30',
  },
  {
    label: 'C',
    badgeBg: 'bg-[#73a900]',
    barFill: 'bg-[#73a900]',
    border: 'border-[#73a900]/30',
  },
  {
    label: 'D',
    badgeBg: 'bg-[#ff5500]',
    barFill: 'bg-[#ff5500]',
    border: 'border-[#ff5500]/30',
  },
];

function getResponderPosition(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) % 1000;
  }
  const side = hash % 2 === 0 ? 'left' : 'right';
  const offsetPct = 4 + (hash % 14);
  const topPct = 22 + ((hash * 7) % 48);
  return { side, offsetPct, topPct };
}

export default function TvBroadcastPage() {
  const [gameState, setGameState] = useState(null);
  const [joinUrl, setJoinUrl] = useState('');
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [smoothRemainingSec, setSmoothRemainingSec] = useState(0);
  const [drumrollSec, setDrumrollSec] = useState(0);

  const prevPhaseRef = useRef(null);
  const prevSecRef = useRef(null);
  const buzzerPlayedForRoundRef = useRef(null);
  const drumrollPlayedForRoundRef = useRef(null);

  const syncSnapshotRef = useRef({
    progress: 0,
    remainingMs: 0,
    durationMs: 15000,
    isPaused: false,
    manualProgress: null,
    isDrumrolling: false,
    drumrollRemainingMs: 0,
    syncedAt: Date.now(),
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setJoinUrl(`${window.location.origin}/play`);
    }
  }, []);

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
            manualProgress: data.activeRound.manualProgress,
            isDrumrolling: Boolean(data.activeRound.isDrumrolling),
            drumrollRemainingMs: data.activeRound.drumrollRemainingMs || 0,
            syncedAt: performance.now(),
          };
        }
      } catch (e) {}
    }

    fetchState();
    const interval = setInterval(fetchState, 400);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let rafId;
    function updateLoop() {
      if (gameState?.phase === 'PLAYING' && gameState?.activeRound) {
        const snap = syncSnapshotRef.current;
        const delta = performance.now() - snap.syncedAt;

        if (snap.isDrumrolling) {
          const dRem = Math.max(0, snap.drumrollRemainingMs - delta);
          setDrumrollSec(Math.ceil(dRem / 1000));
          if (
            gameState.settings?.soundEnabled &&
            drumrollPlayedForRoundRef.current !== gameState.activeRound.roundId
          ) {
            drumrollPlayedForRoundRef.current = gameState.activeRound.roundId;
            soundFX.playDrumroll();
          }
        } else {
          setDrumrollSec(0);
        }

        if (typeof snap.manualProgress === 'number') {
          setSmoothProgress(snap.manualProgress);
          const remMs = snap.isPaused
            ? snap.remainingMs
            : Math.max(0, snap.remainingMs - delta);
          setSmoothRemainingSec(Math.ceil(remMs / 1000));
        } else if (snap.isPaused) {
          setSmoothProgress(snap.progress);
          setSmoothRemainingSec(Math.ceil(snap.remainingMs / 1000));
        } else {
          const remMs = Math.max(0, snap.remainingMs - delta);
          const prog =
            snap.durationMs > 0 ? Math.min(1, 1 - remMs / snap.durationMs) : 1;
          setSmoothProgress(prog);
          const sec = Math.ceil(remMs / 1000);
          setSmoothRemainingSec(sec);

          if (
            gameState.settings?.soundEnabled &&
            sec > 0 &&
            sec <= 5 &&
            prevSecRef.current !== sec
          ) {
            prevSecRef.current = sec;
            soundFX.playTick(sec <= 2);
          }

          if (
            sec === 0 &&
            gameState.settings?.soundEnabled &&
            buzzerPlayedForRoundRef.current !== gameState.activeRound.roundId
          ) {
            buzzerPlayedForRoundRef.current = gameState.activeRound.roundId;
            soundFX.playTimeUpBuzzer();
          }
        }
      } else if (gameState?.phase === 'REVEALED') {
        setSmoothProgress(1);
        setSmoothRemainingSec(0);
        setDrumrollSec(0);
      }
      rafId = requestAnimationFrame(updateLoop);
    }
    rafId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(rafId);
  }, [gameState?.phase, gameState?.activeRound, gameState?.settings?.soundEnabled]);

  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    const curr = gameState.phase;
    if (prev && prev !== curr) {
      if (curr === 'REVEALED') {
        if (gameState.settings?.soundEnabled) soundFX.playReveal();
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.55 },
          colors: ['#008296', '#e5a93c', '#84bd00', '#ff5500', '#00b4cc'],
        });
      } else if (curr === 'RANKING') {
        if (gameState.settings?.soundEnabled) soundFX.playPodium();
        confetti({
          particleCount: 150,
          spread: 115,
          origin: { y: 0.5 },
          colors: ['#008296', '#e5a93c', '#84bd00', '#ff5500'],
        });
      }
    }
    prevPhaseRef.current = curr;
  }, [gameState?.phase, gameState?.settings?.soundEnabled]);

  if (!gameState) {
    return <div className="min-h-screen w-screen bg-transparent" />;
  }

  const chromaMode = gameState.settings?.chromaMode || 'DARK';
  const phase = gameState.phase;
  const round = gameState.activeRound;
  const showQr = gameState.settings?.showQrOnTv !== false;
  const isTimeUp = phase === 'PLAYING' && smoothRemainingSec <= 0;
  const isDrumrolling = phase === 'PLAYING' && round?.isDrumrolling && drumrollSec > 0;
  const multiplier = round?.pointsMultiplier || gameState.settings?.pointsMultiplier || 1;
  const reactions = gameState.reactions || [];
  const showOptionsPanelOnTv = Boolean(round?.showAudienceVotes);

  return (
    <main
      onClick={() => soundFX.init()}
      className={`relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-center select-none ${
        chromaMode === 'TRANSPARENT'
          ? 'bg-transparent'
          : chromaMode === 'GREEN'
          ? 'bg-[#00ff00]'
          : 'bg-[#f6f0e6]'
      }`}
    >
      {/* Key Visual Background Image Layer */}
      {chromaMode === 'DARK' && (
        <div
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/key-visual-bg.jpg')" }}
        />
      )}

      {/* Floating Responder Names in Open Space (with their chosen Emoji, NO response time!) */}
      {phase === 'PLAYING' && round?.recentResponders?.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden">
          {round.recentResponders.slice(0, 6).map((resp) => {
            const pos = getResponderPosition(resp.id);
            return (
              <div
                key={resp.id}
                style={{
                  top: `${pos.topPct}%`,
                  ...(pos.side === 'left'
                    ? { left: `${pos.offsetPct}%` }
                    : { right: `${pos.offsetPct}%` }),
                }}
                className="absolute flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-white/95 border-2 border-[#008296]/40 text-[#005566] shadow-[0_12px_30px_rgba(0,85,102,0.22)] animate-float"
              >
                <span className="text-2xl">{resp.emoji || '😎'}</span>
                <span className="font-display font-black text-2xl md:text-3xl uppercase tracking-wide">
                  {resp.name}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Emoji Reactions Lane */}
      <div className="pointer-events-none fixed bottom-28 left-8 z-50 w-64 h-96 overflow-visible">
        {reactions.map((rx) => (
          <div
            key={rx.id}
            style={{ left: `${rx.offsetLeft || 30}%` }}
            className="absolute bottom-0 flex flex-col items-center animate-emoji-float"
          >
            <span className="text-6xl drop-shadow-[0_6px_12px_rgba(0,0,0,0.3)]">
              {rx.emoji}
            </span>
            <span
              className="mt-1 px-3 py-0.5 rounded-full text-xs font-extrabold text-white shadow-md whitespace-nowrap"
              style={{ backgroundColor: rx.avatarColor || '#008296' }}
            >
              {rx.playerEmoji || ''} {rx.playerName}
            </span>
          </div>
        ))}
      </div>

      {/* Floating QR Widget */}
      {showQr && phase !== 'LOBBY' && joinUrl && (
        <div className="fixed bottom-28 right-7 z-40 flex items-center gap-4 bg-white/95 backdrop-blur-md border-2 border-[#008296]/30 p-3.5 rounded-3xl shadow-[0_16px_40px_rgba(0,85,102,0.22)]">
          <div className="bg-white p-1.5 rounded-2xl border border-[#008296]/15">
            <QRCodeSVG value={joinUrl} size={96} fgColor="#005566" level="M" />
          </div>
          <div className="pr-3">
            <div className="flex items-center gap-1.5 text-[#008296] font-extrabold text-sm uppercase tracking-wider">
              <Users className="w-4 h-4" />
              <span>{gameState.playerCount || 0} JUGANDO</span>
            </div>
            <p className="font-display text-[#005566] font-black text-3xl uppercase tracking-wide leading-none mt-0.5">
              ESCANEA Y JUEGA
            </p>
          </div>
        </div>
      )}

      {/* ================= PHASE 1: LOBBY (Exact Center + 25% Larger) ================= */}
      {phase === 'LOBBY' && (
        <div className="z-10 flex flex-col items-center justify-center text-center px-6 max-w-5xl w-full">
          <div className="inline-flex items-center gap-3 px-8 py-2.5 rounded-full bg-[#008296] text-white font-extrabold text-xl tracking-wider uppercase shadow-lg mb-5">
            <Users className="w-6 h-6" />
            <span>{gameState.playerCount || 0} JUGADORES CONECTADOS</span>
          </div>

          <h1 className="font-display text-8xl md:text-9xl font-black uppercase tracking-wide text-[#005566] drop-shadow-sm mb-8 leading-none">
            ¿QUIÉN ES?
          </h1>

          {joinUrl && (
            <div className="bg-white p-8 rounded-[3rem] shadow-[0_24px_70px_rgba(0,85,102,0.28)] border-4 border-[#008296] animate-float">
              <QRCodeSVG value={joinUrl} size={300} fgColor="#005566" level="M" />
            </div>
          )}

          {gameState.leaderboard?.length > 0 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 max-w-4xl">
              {gameState.leaderboard.slice(0, 14).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-5 py-2 rounded-full bg-white/95 border-2 border-[#008296]/25 shadow-md"
                >
                  <span className="text-xl">{p.emoji || '😎'}</span>
                  <span className="font-extrabold text-[#005566] text-xl">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= PHASE 2 & 3: PLAYING & REVEALED ================= */}
      {(phase === 'PLAYING' || phase === 'REVEALED') && round && (
        <div className="z-10 flex flex-col items-center justify-center w-full max-w-[1600px] px-6">
          <div className="w-full flex flex-wrap items-center justify-center gap-5 mb-5 min-h-[88px]">
            {multiplier > 1 && (
              <div className="flex items-center gap-2.5 px-7 py-3 rounded-3xl bg-gradient-to-r from-[#e5a93c] via-[#ff5500] to-[#e5a93c] border-4 border-white text-white shadow-xl animate-bounce">
                <Sparkles className="w-7 h-7 fill-white" />
                <span className="font-display text-4xl md:text-5xl font-black uppercase tracking-wider">
                  ¡PUNTOS x{multiplier}!
                </span>
              </div>
            )}

            {phase === 'PLAYING' && !isDrumrolling && (
              <div className="flex items-center gap-6 px-10 py-3 rounded-3xl bg-white/95 border-4 border-[#008296] shadow-[0_14px_40px_rgba(0,85,102,0.2)]">
                <span className="font-display text-5xl md:text-6xl font-black uppercase tracking-wider text-[#005566]">
                  ¿QUIÉN ES?
                </span>
                {!isTimeUp && (
                  <>
                    <div className="h-10 w-0.5 bg-[#008296]/25" />
                    <div
                      className={`font-display text-5xl md:text-6xl font-black px-6 py-1 rounded-2xl transition-colors ${
                        smoothRemainingSec <= 5
                          ? 'bg-[#ff5500] text-white animate-bounce'
                          : 'bg-[#008296] text-white'
                      }`}
                    >
                      {smoothRemainingSec}s
                    </div>
                  </>
                )}
              </div>
            )}

            {isDrumrolling && (
              <div className="flex items-center gap-5 px-12 py-3.5 rounded-3xl bg-[#005566] border-4 border-[#e5a93c] text-white shadow-2xl animate-drumroll">
                <span className="font-display text-5xl md:text-6xl font-black uppercase tracking-wider text-[#e5a93c]">
                  ¿QUIÉN ES? {drumrollSec}...
                </span>
              </div>
            )}

            {phase === 'REVEALED' && (
              <div className="flex flex-wrap items-center justify-center gap-5">
                <div className="flex items-center gap-5 px-12 py-3.5 rounded-3xl bg-gradient-to-r from-[#008296] via-[#006b7d] to-[#008296] border-4 border-[#e5a93c] text-white shadow-[0_15px_45px_rgba(0,85,102,0.35)] animate-float">
                  <CheckCircle2 className="w-11 h-11 text-[#84bd00] shrink-0 stroke-[2.5]" />
                  <span className="font-display text-5xl md:text-7xl font-black uppercase tracking-wide">
                    {round.correctName}
                  </span>
                </div>

                {round.fastestWinner && (
                  <div className="flex items-center gap-4 px-7 py-3 rounded-3xl bg-white/95 border-4 border-[#e5a93c] shadow-[0_15px_40px_rgba(229,169,60,0.4)] animate-slide-up">
                    <div className="w-12 h-12 rounded-2xl bg-[#e5a93c] flex items-center justify-center text-[#003d4a] shadow">
                      <Zap className="w-7 h-7 fill-current" />
                    </div>
                    <div className="text-left">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-[#ff5500] leading-none">
                        MÁS RÁPIDO DE LA RONDA
                      </div>
                      <div className="font-display text-4xl font-black text-[#005566] uppercase leading-tight">
                        {round.fastestWinner.emoji || '😎'} {round.fastestWinner.name}{' '}
                        <span className="text-[#84bd00]">
                          +{round.fastestWinner.pointsEarned} PTS
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="relative flex flex-col lg:flex-row items-center justify-center gap-10 w-full">
            <div className="relative flex flex-col items-center shrink-0">
              <div
                className={`relative w-[500px] h-[500px] md:w-[600px] md:h-[600px] xl:w-[650px] xl:h-[650px] rounded-[2.8rem] overflow-hidden bg-white p-3.5 shadow-[0_28px_80px_rgba(0,85,102,0.36)] border-4 ${
                  isDrumrolling
                    ? 'border-[#e5a93c] animate-drumroll'
                    : phase === 'REVEALED'
                    ? 'border-[#84bd00]'
                    : multiplier > 1
                    ? 'border-[#e5a93c] shadow-[0_0_55px_rgba(229,169,60,0.6)]'
                    : isTimeUp
                    ? 'border-[#ff5500] animate-tension-glow'
                    : 'border-[#008296]'
                }`}
              >
                <div className="relative w-full h-full rounded-[2rem] overflow-hidden bg-[#003d4a]">
                  <DistortedCanvas
                    imageSrc={round.imageData}
                    progress={smoothProgress}
                    effectType={round.effectType}
                    isRevealed={phase === 'REVEALED'}
                    className="w-full h-full object-cover"
                  />

                  {isDrumrolling && (
                    <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="font-display text-9xl font-black text-[#e5a93c] drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)] animate-ping">
                        {drumrollSec}
                      </span>
                    </div>
                  )}

                  {phase === 'PLAYING' && !isTimeUp && (
                    <div className="absolute bottom-0 left-0 right-0 h-4 bg-black/45 backdrop-blur-sm">
                      <div
                        className={`h-full transition-none ${
                          smoothRemainingSec <= 5
                            ? 'bg-[#ff5500]'
                            : 'bg-gradient-to-r from-[#00b4cc] via-[#84bd00] to-[#e5a93c]'
                        }`}
                        style={{
                          width: `${Math.max(0, (1 - smoothProgress) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {round.showHintOnTv && round.hintText && (
                <div className="mt-4 max-w-[650px] w-full bg-[#005566] border-l-8 border-[#e5a93c] text-white px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-4 animate-slide-up">
                  <Lightbulb className="w-8 h-8 text-[#e5a93c] shrink-0 fill-[#e5a93c]/20" />
                  <div className="text-left">
                    <span className="block text-xs font-extrabold uppercase tracking-widest text-[#e5a93c]">
                      PISTA EN PANTALLA
                    </span>
                    <span className="font-bold text-lg md:text-xl leading-snug">
                      {round.hintText}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {showOptionsPanelOnTv && (
              <div className="flex flex-col gap-4 w-full max-w-2xl animate-slide-up">
                <div className="flex items-center justify-between px-1">
                  <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-[#005566] text-white font-extrabold text-sm uppercase tracking-wider shadow">
                    <Users className="w-5 h-5 text-[#00b4cc]" />
                    <span>{round.totalVotes || 0} RESPUESTAS</span>
                  </div>
                </div>

                {round.options?.map((optionText, idx) => {
                  const style = OPTION_STYLES[idx % 4];
                  const isCorrect =
                    phase === 'REVEALED' && round.correctOptionIndex === idx;
                  const isWrong =
                    phase === 'REVEALED' && round.correctOptionIndex !== idx;

                  const votesForOption = round.voteCounts
                    ? round.voteCounts[idx] || 0
                    : 0;
                  const votePercent =
                    round.totalVotes > 0
                      ? Math.round((votesForOption / round.totalVotes) * 100)
                      : 0;

                  return (
                    <div
                      key={idx}
                      className={`relative overflow-hidden rounded-3xl border-3 p-5 transition-colors duration-500 ${
                        isCorrect
                          ? 'bg-[#005566] border-4 border-[#84bd00] shadow-[0_12px_35px_rgba(132,189,0,0.45)] text-white'
                          : isWrong
                          ? 'bg-white/60 border-slate-300/60 opacity-50 text-[#005566]'
                          : `bg-white/95 border-2 ${style.border} shadow-[0_10px_30px_rgba(0,85,102,0.15)] text-[#005566]`
                      }`}
                    >
                      <div
                        className={`absolute inset-y-0 left-0 transition-all duration-700 ${
                          isCorrect
                            ? 'bg-[#84bd00]/35'
                            : `${style.barFill} opacity-20`
                        }`}
                        style={{ width: `${votePercent}%` }}
                      />

                      <div className="relative z-10 flex items-center justify-between gap-5">
                        <div className="flex items-center gap-5 min-w-0">
                          <div
                            className={`w-14 h-14 rounded-2xl ${
                              isCorrect
                                ? 'bg-[#84bd00] text-[#003d4a]'
                                : `${style.badgeBg} text-white`
                            } flex items-center justify-center font-display font-black text-4xl shadow-md shrink-0`}
                          >
                            {style.label}
                          </div>
                          <span
                            className={`font-display font-extrabold text-4xl md:text-5xl uppercase tracking-wide truncate ${
                              isCorrect ? 'text-white' : 'text-[#005566]'
                            }`}
                          >
                            {optionText}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={`font-display font-black text-4xl ${
                              isCorrect ? 'text-[#84bd00]' : 'text-[#008296]'
                            }`}
                          >
                            {votePercent}%
                          </span>
                          {isCorrect && (
                            <CheckCircle2 className="w-10 h-10 text-[#84bd00]" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= PHASE 4: RANKING / PODIUM ================= */}
      {phase === 'RANKING' && (
        <div className="z-10 flex flex-col items-center justify-center w-full max-w-5xl px-6">
          <div className="inline-flex items-center gap-3 px-9 py-3 rounded-full bg-[#008296] text-white font-display font-black text-3xl uppercase tracking-wider shadow-lg mb-6">
            <Trophy className="w-8 h-8 text-[#e5a93c]" />
            <span>TABLA DE POSICIONES</span>
          </div>

          <div className="w-full flex flex-col gap-3.5">
            {(!gameState.leaderboard || gameState.leaderboard.length === 0) && (
              <div className="text-center py-16 bg-white/90 rounded-3xl border-2 border-[#008296]/25 text-[#005566] text-3xl font-bold shadow">
                Esperando jugadores...
              </div>
            )}

            {gameState.leaderboard?.slice(0, 7).map((player, idx) => {
              const isFirst = idx === 0;
              const isSecond = idx === 1;
              const isThird = idx === 2;

              return (
                <div
                  key={player.id}
                  className={`flex items-center justify-between px-8 py-4 rounded-3xl border-2 transition-all shadow-md ${
                    isFirst
                      ? 'bg-[#005566] border-4 border-[#e5a93c] text-white shadow-[0_14px_40px_rgba(0,85,102,0.35)]'
                      : isSecond
                      ? 'bg-white/95 border-[#008296] text-[#005566]'
                      : isThird
                      ? 'bg-white/95 border-[#84bd00] text-[#005566]'
                      : 'bg-white/85 border-[#008296]/20 text-[#005566]'
                  }`}
                >
                  <div className="flex items-center gap-5">
                    <div
                      className={`w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-3xl ${
                        isFirst
                          ? 'bg-[#e5a93c] text-[#003d4a]'
                          : isSecond
                          ? 'bg-[#008296] text-white'
                          : isThird
                          ? 'bg-[#84bd00] text-white'
                          : 'bg-[#e6dfd3] text-[#005566]'
                      }`}
                    >
                      {idx + 1}
                    </div>

                    <div className="flex items-center gap-3.5">
                      <span className="text-3xl">{player.emoji || '😎'}</span>
                      <span className="font-display font-black text-4xl uppercase tracking-wide">
                        {player.name}
                      </span>
                      {player.streak >= 2 && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#ff5500] text-white text-sm font-extrabold">
                          <Flame className="w-4 h-4 fill-white" />x
                          {player.streak}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`font-display font-black text-4xl tracking-wide ${
                      isFirst ? 'text-[#e5a93c]' : 'text-[#008296]'
                    }`}
                  >
                    {player.score.toLocaleString()}{' '}
                    <span className="text-lg font-sans font-bold opacity-75">
                      PTS
                    </span>
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
