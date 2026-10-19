'use client';

import React, { useEffect, useState, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  Sparkles,
  Lightbulb,
} from 'lucide-react';
import DistortedCanvas from '@/components/DistortedCanvas';

const FAMOUS_EMOJIS = [
  '😎',
  '🔥',
  '🤩',
  '😂',
  '🚀',
  '👑',
  '🦄',
  '⚡',
  '🎉',
  '❤️',
];

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
    bg: 'bg-[#008296] active:bg-[#005566] active:scale-[0.97]',
    border: 'border-[#005566]',
  },
  {
    label: 'B',
    bg: 'bg-[#e59a24] active:bg-[#b8740a] active:scale-[0.97]',
    border: 'border-[#b8740a]',
  },
  {
    label: 'C',
    bg: 'bg-[#73a900] active:bg-[#527800] active:scale-[0.97]',
    border: 'border-[#527800]',
  },
  {
    label: 'D',
    bg: 'bg-[#ff5500] active:bg-[#c43e00] active:scale-[0.97]',
    border: 'border-[#c43e00]',
  },
];

const REACTION_EMOJIS = ['🔥', '😂', '🤯', '👏', '❤️', '🎉'];

export default function MobilePlayerPage() {
  const [playerId, setPlayerId] = useState(null);
  const [nickname, setNickname] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(FAMOUS_EMOJIS[0]);
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0]);
  const [isJoined, setIsJoined] = useState(false);
  const [joining, setJoining] = useState(false);

  const [gameState, setGameState] = useState(null);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [smoothRemainingSec, setSmoothRemainingSec] = useState(0);
  const [drumrollSec, setDrumrollSec] = useState(0);

  const lastTapTimeRef = useRef(0);

  const syncSnapshotRef = useRef({
    progress: 0,
    remainingMs: 0,
    durationMs: 15000,
    isPaused: false,
    manualProgress: null,
    isDrumrolling: false,
    drumrollRemainingMs: 0,
    syncedAt: 0,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let storedId = null;
    let storedName = null;
    let storedEmoji = null;
    let storedColor = null;

    try {
      storedId = localStorage.getItem('quienes_player_id');
      storedName = localStorage.getItem('quienes_player_name');
      storedEmoji = localStorage.getItem('quienes_player_emoji');
      storedColor = localStorage.getItem('quienes_player_color');
    } catch (e) {
      // Fallback if iOS Private Browsing blocks localStorage
    }

    if (!storedId) {
      storedId = `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      try {
        localStorage.setItem('quienes_player_id', storedId);
      } catch (e) {}
    }
    setPlayerId(storedId);
    if (storedName) setNickname(storedName);
    if (storedEmoji) setSelectedEmoji(storedEmoji);
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
        } else {
          setIsJoined(false);
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

    poll();
    const interval = setInterval(poll, 500);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [playerId]);

  // IMPORTANT FOR iOS SAFARI:
  // Instead of 60fps re-renders (which cancel touch/click events on iOS Safari),
  // update at a gentle 4fps (every 250ms) and only when values meaningfully change!
  useEffect(() => {
    function tick() {
      if (gameState?.phase === 'PLAYING' && gameState?.activeRound) {
        const snap = syncSnapshotRef.current;
        const delta = performance.now() - snap.syncedAt;

        if (snap.isDrumrolling) {
          const dRem = Math.max(0, snap.drumrollRemainingMs - delta);
          setDrumrollSec(Math.ceil(dRem / 1000));
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
          // Round progress to 2 decimals so React skips unnecessary DOM updates while finger is tapping
          setSmoothProgress(Math.round(prog * 50) / 50);
          setSmoothRemainingSec(Math.ceil(remMs / 1000));
        }
      } else if (gameState?.phase === 'REVEALED') {
        setSmoothProgress(1);
        setSmoothRemainingSec(0);
        setDrumrollSec(0);
      }
    }

    tick();
    const timerId = setInterval(tick, 250);
    return () => clearInterval(timerId);
  }, [gameState?.phase, gameState?.activeRound]);

  async function handleJoin(e) {
    e.preventDefault();
    if (!nickname.trim() || !playerId) return;
    setJoining(true);
    try {
      try {
        localStorage.setItem('quienes_player_name', nickname.trim());
        localStorage.setItem('quienes_player_emoji', selectedEmoji);
        localStorage.setItem('quienes_player_color', selectedColor);
      } catch (err) {}

      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'JOIN_PLAYER',
          role: 'player',
          playerId,
          name: nickname.trim(),
          emoji: selectedEmoji,
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
    if (!playerId || !gameState?.activeRound) return;
    // Prevent accidental double fire from onTouchStart + onClick on iOS
    const now = Date.now();
    if (now - lastTapTimeRef.current < 180) return;
    lastTapTimeRef.current = now;

    // Optimistically update local state so the single-reaction bar appears immediately on iPhone
    setGameState((prev) => {
      if (!prev || !prev.activeRound) return prev;
      const prevAns =
        prev.me?.lastAnswer?.roundId === prev.activeRound.roundId
          ? prev.me.lastAnswer
          : null;
      return {
        ...prev,
        me: {
          ...(prev.me || { id: playerId, name: nickname }),
          lastAnswer: {
            roundId: prev.activeRound.roundId,
            optionIndex,
            answeredAt: now,
            hasReacted: Boolean(prevAns?.hasReacted),
          },
        },
      };
    });

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
      if (res.ok) {
        const data = await res.json();
        setGameState(data);
      }
    } catch (e) {}
  }

  async function handleSendReaction(emoji) {
    if (!playerId) return;
    // Optimistically hide reaction bar immediately after 1 tap
    setGameState((prev) => {
      if (!prev || !prev.me?.lastAnswer) return prev;
      return {
        ...prev,
        me: {
          ...prev.me,
          lastAnswer: {
            ...prev.me.lastAnswer,
            hasReacted: true,
          },
        },
      };
    });

    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SEND_REACTION',
          role: 'player',
          playerId,
          emoji,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGameState(data);
      }
    } catch (e) {}
  }

  // Screen 1: Nickname + 10 Famous Emojis Registration
  if (!isJoined || !gameState?.me) {
    return (
      <main
        className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-cover bg-center touch-manipulation"
        style={{ backgroundImage: "url('/key-visual-bg.jpg')" }}
      >
        <div className="w-full max-w-sm bg-white/95 backdrop-blur-md border-4 border-[#008296] rounded-3xl p-7 shadow-2xl">
          <div className="text-center mb-5">
            <h1 className="font-display text-4xl font-black text-[#005566] uppercase tracking-wide">
              ¿QUIÉN ES?
            </h1>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#005566] mb-1.5">
                Tu Nombre o Apodo
              </label>
              <input
                type="text"
                maxLength={18}
                required
                placeholder="Ej. Camila"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#f6f0e6] border-2 border-[#008296]/40 text-[#005566] font-extrabold text-lg focus:outline-none focus:border-[#008296]"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#005566] mb-1.5">
                Elige tu Emoji
              </label>
              <div className="grid grid-cols-5 gap-2">
                {FAMOUS_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setSelectedEmoji(em)}
                    className={`h-11 rounded-2xl text-2xl flex items-center justify-center transition-all touch-manipulation cursor-pointer ${
                      selectedEmoji === em
                        ? 'bg-[#008296] scale-110 shadow-md ring-2 ring-[#005566]'
                        : 'bg-[#f6f0e6] opacity-75 hover:opacity-100'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-[#005566] mb-1.5">
                Color
              </label>
              <div className="flex items-center justify-between gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`w-9 h-9 rounded-full transition-transform touch-manipulation cursor-pointer ${
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
              className="w-full py-4 rounded-2xl bg-[#008296] hover:bg-[#006b7d] text-white font-display font-black text-2xl uppercase tracking-wider shadow-lg active:scale-98 disabled:opacity-50 touch-manipulation cursor-pointer"
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
  const isDrumrolling = phase === 'PLAYING' && round?.isDrumrolling && drumrollSec > 0;
  const multiplier = round?.pointsMultiplier || gameState.settings?.pointsMultiplier || 1;
  const canSendSingleReaction =
    Boolean(myCurrentRoundAnswer) && !myCurrentRoundAnswer.hasReacted;

  return (
    <main
      className="min-h-screen w-full flex flex-col justify-center p-4 pb-8 max-w-md mx-auto select-none touch-manipulation bg-cover bg-center"
      style={{
        backgroundImage: "url('/key-visual-bg.jpg')",
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* ================= LOBBY OR RANKING STATE ON MOBILE ================= */}
      {(phase === 'LOBBY' || phase === 'RANKING') && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-2 my-4 gap-4">
          <div className="bg-white/95 border-4 border-[#008296] rounded-3xl p-7 shadow-2xl w-full">
            <div className="w-16 h-16 rounded-2xl bg-[#008296]/15 flex items-center justify-center mx-auto mb-3 animate-pulse">
              <Sparkles className="w-9 h-9 text-[#008296]" />
            </div>
            <h2 className="font-display text-3xl font-black text-[#005566] uppercase mb-1">
              ¡ATENTO A LA PANTALLA!
            </h2>
            <p className="text-[#005566]/80 font-bold text-sm">
              Mira la pantalla gigante para seguir la partida y la próxima foto.
            </p>
          </div>
        </div>
      )}

      {/* ================= PLAYING OR REVEALED STATE ================= */}
      {(phase === 'PLAYING' || phase === 'REVEALED') && round && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2.5 my-2">
          {/* Top Header Pill SEPARATED above the face frame */}
          <div className="w-full flex flex-wrap items-center justify-center gap-2">
            {multiplier > 1 && (
              <div className="px-4 py-1 rounded-full bg-gradient-to-r from-[#e5a93c] to-[#ff5500] border-2 border-white text-white font-display font-black text-lg uppercase shadow">
                ¡PUNTOS x{multiplier}!
              </div>
            )}

            {phase === 'PLAYING' && !isDrumrolling && (
              <div
                className={`px-6 py-1 rounded-full font-display font-black text-2xl uppercase tracking-wider border-2 shadow-md ${
                  !isTimeUp && smoothRemainingSec <= 5
                    ? 'bg-[#ff5500] border-white text-white animate-bounce'
                    : 'bg-[#005566] border-[#008296] text-white'
                }`}
              >
                {isTimeUp ? '¿QUIÉN ES?' : `¿QUIÉN ES? • ${smoothRemainingSec}s`}
              </div>
            )}

            {isDrumrolling && (
              <div className="px-6 py-1 rounded-full bg-[#005566] border-2 border-[#e5a93c] text-[#e5a93c] font-display font-black text-2xl uppercase tracking-wider shadow-lg animate-drumroll">
                ¿QUIÉN ES? {drumrollSec}...
              </div>
            )}

            {phase === 'REVEALED' && (
              <div className="px-6 py-1 rounded-full bg-[#008296] border-2 border-[#e5a93c] text-white font-display font-black text-2xl uppercase tracking-wider shadow-lg">
                {round.correctName}
              </div>
            )}
          </div>

          {/* Synchronized Distorted Face on Mobile */}
          <div
            className={`relative w-44 h-44 sm:w-52 sm:h-52 rounded-3xl overflow-hidden border-4 bg-white p-1.5 shadow-xl ${
              isDrumrolling
                ? 'border-[#e5a93c] animate-drumroll'
                : multiplier > 1
                ? 'border-[#e5a93c]'
                : 'border-[#008296]'
            }`}
          >
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-[#003d4a]">
              <DistortedCanvas
                imageSrc={round.imageData}
                progress={smoothProgress}
                effectType={round.effectType}
                isRevealed={phase === 'REVEALED'}
                className="w-full h-full object-cover"
              />
              {isDrumrolling && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                  <span className="font-display text-7xl font-black text-[#e5a93c] animate-ping">
                    {drumrollSec}
                  </span>
                </div>
              )}
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

          {/* Hint Pill on Mobile if Director turned it on */}
          {round.showHintOnTv && round.hintText && (
            <div className="w-full bg-[#005566] border-l-4 border-[#e5a93c] text-white px-3.5 py-2 rounded-xl shadow flex items-center gap-2 text-xs">
              <Lightbulb className="w-4 h-4 text-[#e5a93c] shrink-0" />
              <span className="font-bold truncate">{round.hintText}</span>
            </div>
          )}

          {/* 1) PLAYING & Timer Running -> 4 Option Buttons optimized for iOS Safari touch */}
          {phase === 'PLAYING' && !isTimeUp && (
            <div className="grid grid-cols-1 gap-2.5 w-full mt-1 relative z-30">
              {round.options?.map((optionText, idx) => {
                const style = OPTION_STYLES[idx % 4];
                return (
                  <button
                    key={idx}
                    type="button"
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleSelectOption(idx);
                    }}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl ${style.bg} border-b-4 ${style.border} text-left shadow-lg transition-transform touch-manipulation cursor-pointer select-none`}
                  >
                    <span className="w-8 h-8 rounded-xl bg-black/20 flex items-center justify-center font-display font-black text-xl text-white shrink-0 pointer-events-none">
                      {style.label}
                    </span>
                    <span className="font-display font-black text-white text-2xl uppercase tracking-wide leading-tight pointer-events-none">
                      {optionText}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* 2) PLAYING & Timer Reached 0 -> Waiting for Admin reveal */}
          {phase === 'PLAYING' && isTimeUp && (
            <div className="w-full bg-white/95 border-4 border-[#008296] rounded-3xl p-5 text-center shadow-xl">
              <div className="font-display font-black text-2xl uppercase text-[#005566]">
                ¡MIRA LA PANTALLA GIGANTE!
              </div>
              <div className="text-[#005566]/80 text-xs font-bold mt-1">
                En instantes se revelará quién es el personaje...
              </div>
            </div>
          )}

          {/* 3) REVEALED: Must say strictly "CORRECTO" or "INCORRECTO" */}
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
                  <CheckCircle2 className="w-11 h-11 text-[#84bd00] mx-auto mb-1" />
                  <div className="font-display font-black text-3xl uppercase">
                    CORRECTO
                  </div>
                  <div className="text-[#e5a93c] text-lg font-extrabold mt-0.5 uppercase">
                    {round.correctName}
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="w-11 h-11 text-[#ff5500] mx-auto mb-1" />
                  <div className="font-display font-black text-3xl uppercase text-[#ff5500]">
                    INCORRECTO
                  </div>
                  <div className="text-[#005566] text-base font-extrabold mt-0.5">
                    Era:{' '}
                    <span className="text-[#008296] uppercase">
                      {round.correctName}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Strictly 1 Emoji Reaction allowed per question AFTER the player has answered */}
          {canSendSingleReaction && (
            <div className="w-full bg-white/95 border-2 border-[#008296]/30 rounded-2xl p-2.5 text-center shadow mt-1 relative z-30">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#008296] mb-1">
                ENVÍA 1 REACCIÓN A LA PANTALLA
              </div>
              <div className="flex items-center justify-around">
                {REACTION_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      handleSendReaction(em);
                    }}
                    onClick={() => handleSendReaction(em)}
                    className="text-2xl p-1.5 rounded-xl bg-[#f6f0e6] active:scale-125 transition-transform touch-manipulation cursor-pointer"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
