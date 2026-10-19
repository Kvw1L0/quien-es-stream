'use client';

import React, { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import { Trophy, Users, Flame, CheckCircle2, Lock } from 'lucide-react';
import DistortedCanvas from '@/components/DistortedCanvas';
import { soundFX } from '@/lib/soundEffects';

// Branded Option Styles matching Hogar de Cristo Key Visual
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

export default function TvBroadcastPage() {
  const [gameState, setGameState] = useState(null);
  const [joinUrl, setJoinUrl] = useState('');
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [smoothRemainingSec, setSmoothRemainingSec] = useState(0);

  const prevPhaseRef = useRef(null);
  const prevSecRef = useRef(null);
  const buzzerPlayedForRoundRef = useRef(null);

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

  // Poll server state every 450ms
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
    const interval = setInterval(fetchState, 450);
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
          const prog =
            snap.durationMs > 0 ? Math.min(1, 1 - remMs / snap.durationMs) : 1;
          setSmoothProgress(prog);
          const sec = Math.ceil(remMs / 1000);
          setSmoothRemainingSec(sec);

          // Countdown ticks in last 5 seconds
          if (
            gameState.settings?.soundEnabled &&
            sec > 0 &&
            sec <= 5 &&
            prevSecRef.current !== sec
          ) {
            prevSecRef.current = sec;
            soundFX.playTick(sec <= 2);
          }

          // When timer hits 0, play dramatic Time-Up Buzzer once (without revealing!)
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
      }
      rafId = requestAnimationFrame(updateLoop);
    }
    rafId = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(rafId);
  }, [gameState?.phase, gameState?.activeRound, gameState?.settings?.soundEnabled]);

  // Trigger confetti & SFX ONLY when Admin manually transitions to REVEALED or RANKING
  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    const curr = gameState.phase;
    if (prev && prev !== curr) {
      if (curr === 'REVEALED') {
        if (gameState.settings?.soundEnabled) soundFX.playReveal();
        confetti({
          particleCount: 110,
          spread: 85,
          origin: { y: 0.55 },
          colors: ['#008296', '#e5a93c', '#84bd00', '#ff5500', '#00b4cc'],
        });
      } else if (curr === 'RANKING') {
        if (gameState.settings?.soundEnabled) soundFX.playPodium();
        confetti({
          particleCount: 140,
          spread: 110,
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

  return (
    <main
      onClick={() => soundFX.init()}
      className={`relative min-h-screen w-screen overflow-hidden flex flex-col items-center justify-start pt-6 md:pt-8 pb-36 select-none ${
        chromaMode === 'TRANSPARENT'
          ? 'bg-transparent'
          : chromaMode === 'GREEN'
          ? 'bg-[#00ff00]'
          : 'bg-[#f6f0e6]'
      }`}
    >
      {/* Key Visual Background Image Layer (when not in OBS Transparent or Chroma Green mode) */}
      {chromaMode === 'DARK' && (
        <div
          className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/key-visual-bg.jpg')" }}
        />
      )}

      {/* Floating QR Widget (Positioned in top-left / mid-left safe zone so it never collides with the Hogar de Cristo logo at top-right or balloons at bottom) */}
      {showQr && phase !== 'LOBBY' && joinUrl && (
        <div className="fixed bottom-28 right-7 z-40 flex items-center gap-3.5 bg-white/95 backdrop-blur-md border-2 border-[#008296]/30 p-3 rounded-3xl shadow-[0_16px_40px_rgba(0,85,102,0.22)]">
          <div className="bg-white p-1.5 rounded-2xl border border-[#008296]/15">
            <QRCodeSVG value={joinUrl} size={86} fgColor="#005566" level="M" />
          </div>
          <div className="pr-3">
            <div className="flex items-center gap-1.5 text-[#008296] font-extrabold text-xs uppercase tracking-wider">
              <Users className="w-3.5 h-3.5" />
              <span>{gameState.playerCount || 0} JUGANDO</span>
            </div>
            <p className="font-display text-[#005566] font-black text-2xl uppercase tracking-wide leading-none mt-0.5">
              ESCANEA Y JUEGA
            </p>
          </div>
        </div>
      )}

      {/* ================= PHASE 1: LOBBY ================= */}
      {phase === 'LOBBY' && (
        <div className="z-10 flex flex-col items-center justify-center text-center px-6 max-w-4xl w-full mt-4">
          <div className="inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-[#008296] text-white font-extrabold text-base tracking-wider uppercase shadow-lg mb-4">
            <Users className="w-5 h-5" />
            <span>{gameState.playerCount || 0} JUGADORES CONECTADOS</span>
          </div>

          <h1 className="font-display text-7xl md:text-8xl font-black uppercase tracking-wide text-[#005566] drop-shadow-sm mb-6 leading-none">
            ¿QUIÉN ES EL PERSONAJE?
          </h1>

          {joinUrl && (
            <div className="bg-white p-6 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,85,102,0.25)] border-4 border-[#008296] animate-float">
              <QRCodeSVG value={joinUrl} size={240} fgColor="#005566" level="M" />
            </div>
          )}

          {/* Connected player pills */}
          {gameState.leaderboard?.length > 0 && (
            <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 max-w-3xl">
              {gameState.leaderboard.slice(0, 14).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 border-2 border-[#008296]/25 shadow-md"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: p.avatarColor || '#008296' }}
                  />
                  <span className="font-extrabold text-[#005566] text-base">
                    {p.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================= PHASE 2 & 3: PLAYING, TIME-UP SUSPENSE & REVEALED ================= */}
      {(phase === 'PLAYING' || phase === 'REVEALED') && round && (
        <div className="z-10 flex flex-col items-center w-full max-w-6xl px-8">
          {/* TOP DEDICATED TELEVISION HEADER BANNER (Completely above and separated from the face box so it NEVER overlaps the portrait!) */}
          <div className="w-full flex items-center justify-center mb-5 min-h-[76px]">
            {phase === 'PLAYING' && !isTimeUp && (
              <div className="flex items-center gap-5 px-8 py-3 rounded-3xl bg-white/95 border-4 border-[#008296] shadow-[0_12px_35px_rgba(0,85,102,0.18)]">
                <span className="font-display text-3xl md:text-4xl font-black uppercase tracking-wider text-[#005566]">
                  ¿QUIÉN ES?
                </span>
                <div className="h-8 w-0.5 bg-[#008296]/25" />
                <div
                  className={`font-display text-4xl md:text-5xl font-black px-5 py-1 rounded-2xl transition-colors ${
                    smoothRemainingSec <= 5
                      ? 'bg-[#ff5500] text-white animate-bounce'
                      : 'bg-[#008296] text-white'
                  }`}
                >
                  {smoothRemainingSec}s
                </div>
              </div>
            )}

            {/* SUSPENSE STATE: Timer reached 0, waiting for Admin to manually release answer */}
            {phase === 'PLAYING' && isTimeUp && (
              <div className="flex items-center gap-4 px-9 py-3.5 rounded-3xl bg-gradient-to-r from-[#ff5500] via-[#e59a24] to-[#ff5500] border-4 border-white text-white shadow-2xl animate-tension-glow">
                <Lock className="w-8 h-8 stroke-[2.5]" />
                <span className="font-display text-4xl md:text-5xl font-black uppercase tracking-wider">
                  ¡TIEMPO CUMPLIDO! ¿QUIÉN ES?
                </span>
              </div>
            )}

            {/* REVEALED STATE: Admin released the answer! Placed cleanly above the photo */}
            {phase === 'REVEALED' && (
              <div className="flex items-center gap-4 px-10 py-3.5 rounded-3xl bg-gradient-to-r from-[#008296] via-[#006b7d] to-[#008296] border-4 border-[#e5a93c] text-white shadow-[0_15px_45px_rgba(0,85,102,0.35)] animate-float">
                <CheckCircle2 className="w-9 h-9 text-[#84bd00] shrink-0 stroke-[2.5]" />
                <span className="font-display text-4xl md:text-6xl font-black uppercase tracking-wide">
                  {round.correctName}
                </span>
              </div>
            )}
          </div>

          {/* MAIN TELEVISION STAGE: Left = Portrait Frame (100% unobstructed), Right = 4 Broadcast Option Bars */}
          <div className="w-full flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-12">
            {/* Portrait Frame */}
            <div className="relative flex flex-col items-center shrink-0">
              <div
                className={`relative w-[360px] h-[360px] md:w-[410px] md:h-[410px] rounded-[2.2rem] overflow-hidden bg-white p-2.5 shadow-[0_20px_55px_rgba(0,85,102,0.28)] border-4 transition-all duration-500 ${
                  phase === 'REVEALED'
                    ? 'border-[#84bd00] scale-[1.02]'
                    : isTimeUp
                    ? 'border-[#ff5500] animate-tension-glow'
                    : 'border-[#008296]'
                }`}
              >
                <div className="relative w-full h-full rounded-[1.6rem] overflow-hidden bg-[#003d4a]">
                  <DistortedCanvas
                    imageSrc={round.imageData}
                    progress={smoothProgress}
                    effectType={round.effectType}
                    isRevealed={phase === 'REVEALED'}
                    className="w-full h-full object-cover"
                  />

                  {/* Sleek bottom progress bar inside frame */}
                  {phase === 'PLAYING' && !isTimeUp && (
                    <div className="absolute bottom-0 left-0 right-0 h-3 bg-black/40 backdrop-blur-sm">
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
            </div>

            {/* Right Column: 4 Television Broadcast Option Cards */}
            <div className="flex flex-col gap-3.5 w-full max-w-xl">
              {/* Live vote counter pill */}
              <div className="flex items-center justify-between px-2">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#005566] text-white font-extrabold text-xs uppercase tracking-wider shadow">
                  <Users className="w-4 h-4 text-[#00b4cc]" />
                  <span>{round.totalVotes || 0} RESPUESTAS EN VIVO</span>
                </div>
                {phase === 'PLAYING' && isTimeUp && (
                  <span className="text-xs font-extrabold uppercase tracking-wider text-[#ff5500] bg-white px-3 py-1 rounded-full shadow">
                    Votación Cerrada
                  </span>
                )}
              </div>

              {round.options?.map((optionText, idx) => {
                const style = OPTION_STYLES[idx % 4];
                const isCorrect =
                  phase === 'REVEALED' && round.correctOptionIndex === idx;
                const isWrong =
                  phase === 'REVEALED' && round.correctOptionIndex !== idx;

                const showVotes =
                  phase === 'REVEALED' || Boolean(round.showAudienceVotes);
                const votesForOption = round.voteCounts
                  ? round.voteCounts[idx] || 0
                  : 0;
                const votePercent =
                  showVotes && round.totalVotes > 0
                    ? Math.round((votesForOption / round.totalVotes) * 100)
                    : 0;

                return (
                  <div
                    key={idx}
                    className={`relative overflow-hidden rounded-2xl border-3 p-4 transition-all duration-500 ${
                      isCorrect
                        ? 'bg-[#005566] border-4 border-[#84bd00] scale-[1.03] shadow-[0_12px_35px_rgba(132,189,0,0.45)] text-white'
                        : isWrong
                        ? 'bg-white/60 border-slate-300/60 opacity-50 scale-[0.98] text-[#005566]'
                        : `bg-white/95 border-2 ${style.border} shadow-[0_8px_25px_rgba(0,85,102,0.12)] text-[#005566]`
                    }`}
                  >
                    {/* Percentage fill bar when revealed or when Admin toggles Audience Poll */}
                    {showVotes && (
                      <div
                        className={`absolute inset-y-0 left-0 transition-all duration-1000 ${
                          isCorrect
                            ? 'bg-[#84bd00]/30'
                            : `${style.barFill} opacity-15`
                        }`}
                        style={{ width: `${votePercent}%` }}
                      />
                    )}

                    <div className="relative z-10 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-xl ${
                            isCorrect ? 'bg-[#84bd00] text-[#003d4a]' : `${style.badgeBg} text-white`
                          } flex items-center justify-center font-display font-black text-3xl shadow-md shrink-0`}
                        >
                          {style.label}
                        </div>
                        <span
                          className={`font-display font-extrabold text-3xl md:text-4xl uppercase tracking-wide truncate ${
                            isCorrect ? 'text-white' : 'text-[#005566]'
                          }`}
                        >
                          {optionText}
                        </span>
                      </div>

                      {showVotes && (
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`font-display font-black text-3xl ${
                              isCorrect ? 'text-[#84bd00]' : 'text-[#008296]'
                            }`}
                          >
                            {votePercent}%
                          </span>
                          {isCorrect && (
                            <CheckCircle2 className="w-8 h-8 text-[#84bd00]" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= PHASE 4: RANKING / PODIUM ================= */}
      {phase === 'RANKING' && (
        <div className="z-10 flex flex-col items-center justify-center w-full max-w-4xl px-6 mt-2">
          <div className="inline-flex items-center gap-2.5 px-7 py-2 rounded-full bg-[#008296] text-white font-display font-black text-2xl uppercase tracking-wider shadow-lg mb-5">
            <Trophy className="w-6 h-6 text-[#e5a93c]" />
            <span>TABLA DE POSICIONES</span>
          </div>

          <div className="w-full flex flex-col gap-3">
            {(!gameState.leaderboard || gameState.leaderboard.length === 0) && (
              <div className="text-center py-14 bg-white/90 rounded-3xl border-2 border-[#008296]/25 text-[#005566] text-2xl font-bold shadow">
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
                  className={`flex items-center justify-between px-6 py-3.5 rounded-2xl border-2 transition-all shadow-md ${
                    isFirst
                      ? 'bg-[#005566] border-4 border-[#e5a93c] text-white scale-[1.02] shadow-[0_12px_35px_rgba(0,85,102,0.35)]'
                      : isSecond
                      ? 'bg-white/95 border-[#008296] text-[#005566]'
                      : isThird
                      ? 'bg-white/95 border-[#84bd00] text-[#005566]'
                      : 'bg-white/85 border-[#008296]/20 text-[#005566]'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-display font-black text-2xl ${
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

                    <div className="flex items-center gap-3">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{
                          backgroundColor: player.avatarColor || '#008296',
                        }}
                      />
                      <span className="font-display font-black text-3xl uppercase tracking-wide">
                        {player.name}
                      </span>
                      {player.streak >= 2 && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#ff5500] text-white text-xs font-extrabold">
                          <Flame className="w-3.5 h-3.5 fill-white" />x
                          {player.streak}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`font-display font-black text-3xl tracking-wide ${
                      isFirst ? 'text-[#e5a93c]' : 'text-[#008296]'
                    }`}
                  >
                    {player.score.toLocaleString()}{' '}
                    <span className="text-base font-sans font-bold opacity-75">
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
