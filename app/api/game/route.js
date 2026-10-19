import { NextResponse } from 'next/server';
import {
  getGameState,
  saveGameState,
  computeRoundProgress,
  generateOptionsForPhoto,
} from '@/lib/gameStore';

export const dynamic = 'force-dynamic';

function buildClientPayload(state, role, playerId) {
  const now = Date.now();
  // IMPORTANT: We NEVER auto-reveal when the timer finishes!
  // Only the Admin can manually trigger REVEALED to build maximum TV suspense.
  const currentPhase = state.phase;
  let roundStatus = { progress: 0, remainingMs: 0, elapsedMs: 0, isFinished: false };

  if (state.activeRound) {
    roundStatus = computeRoundProgress(state.activeRound, now);
  }

  const activePhoto = state.activeRound
    ? state.photos.find((p) => p.id === state.activeRound.photoId) || null
    : null;

  const playersList = Object.values(state.players || {}).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.joinedAt || 0) - (b.joinedAt || 0);
  });

  const voteCounts = [0, 0, 0, 0];
  let totalVotes = 0;
  if (state.activeRound) {
    for (const p of playersList) {
      if (p.lastAnswer && p.lastAnswer.roundId === state.activeRound.roundId) {
        const idx = p.lastAnswer.optionIndex;
        if (idx >= 0 && idx < 4) {
          voteCounts[idx]++;
          totalVotes++;
        }
      }
    }
  }

  const isRevealed = currentPhase === 'REVEALED';
  const isTimeUp = currentPhase === 'PLAYING' && roundStatus.isFinished;

  const basePayload = {
    version: state.version,
    serverNow: now,
    phase: currentPhase,
    settings: state.settings,
    playerCount: playersList.length,
    leaderboard: playersList.slice(0, 20).map((p, idx) => ({
      id: p.id,
      name: p.name,
      avatarColor: p.avatarColor,
      score: p.score,
      streak: p.streak || 0,
      rank: idx + 1,
      hasAnsweredCurrentRound:
        state.activeRound && p.lastAnswer?.roundId === state.activeRound.roundId,
      lastRoundPoints:
        isRevealed && state.activeRound && p.lastAnswer?.roundId === state.activeRound.roundId
          ? p.lastAnswer.pointsEarned
          : null,
    })),
    activeRound: state.activeRound
      ? {
          roundId: state.activeRound.roundId,
          photoId: state.activeRound.photoId,
          imageData: activePhoto ? activePhoto.imageData : null,
          // Never leak correctName or correctOptionIndex to TV or Players until Admin clicks REVEAL_NOW
          correctName: isRevealed || role === 'admin' ? activePhoto?.name : null,
          options: state.activeRound.options,
          correctOptionIndex:
            isRevealed || role === 'admin' ? state.activeRound.correctOptionIndex : null,
          durationMs: state.activeRound.durationMs,
          isPaused: state.activeRound.isPaused,
          effectType: state.activeRound.effectType,
          progress: isRevealed ? 1 : roundStatus.progress,
          remainingMs: isRevealed ? 0 : roundStatus.remainingMs,
          elapsedMs: roundStatus.elapsedMs,
          isTimeUp,
          // Allow showing audience vote distribution on TV if Admin enables "Audience Poll" during Time Up, or when Revealed
          showAudienceVotes: Boolean(state.activeRound.showAudienceVotes),
          voteCounts:
            isRevealed || role === 'admin' || state.activeRound.showAudienceVotes
              ? voteCounts
              : null,
          totalVotes,
        }
      : null,
  };

  if (role === 'admin') {
    basePayload.photos = state.photos;
    basePayload.allPlayers = playersList;
  }

  if (playerId && state.players[playerId]) {
    const me = state.players[playerId];
    const myRank = playersList.findIndex((p) => p.id === playerId) + 1;
    // IMPORTANT: Do NOT reveal `isCorrect` or `pointsEarned` to the mobile player until Admin reveals!
    const sanitizedLastAnswer = me.lastAnswer
      ? {
          roundId: me.lastAnswer.roundId,
          optionIndex: me.lastAnswer.optionIndex,
          answeredAt: me.lastAnswer.answeredAt,
          elapsedMs: me.lastAnswer.elapsedMs,
          isCorrect: isRevealed ? me.lastAnswer.isCorrect : null,
          pointsEarned: isRevealed ? me.lastAnswer.pointsEarned : null,
        }
      : null;

    basePayload.me = {
      ...me,
      // Hide current round points from player's visible total score until Admin reveals
      score:
        !isRevealed &&
        state.activeRound &&
        me.lastAnswer?.roundId === state.activeRound.roundId
          ? me.score - (me.lastAnswer.pointsEarned || 0)
          : me.score,
      lastAnswer: sanitizedLastAnswer,
      rank: myRank,
    };
  }

  return { payload: basePayload };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') || 'player';
  const playerId = searchParams.get('playerId') || null;

  const state = await getGameState();
  const { payload } = buildClientPayload(state, role, playerId);

  return NextResponse.json(payload);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { action } = body;
    const state = await getGameState();
    const now = Date.now();

    switch (action) {
      // ================= PLAYER ACTIONS =================
      case 'JOIN_PLAYER': {
        const { playerId, name, avatarColor } = body;
        if (!playerId || !name || !name.trim()) {
          return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
        }
        const cleanName = name.trim().slice(0, 18);
        const existing = state.players[playerId];
        state.players[playerId] = {
          id: playerId,
          name: cleanName,
          avatarColor: avatarColor || existing?.avatarColor || '#008296',
          score: existing ? existing.score : 0,
          streak: existing ? existing.streak : 0,
          joinedAt: existing ? existing.joinedAt : now,
          lastAnswer: existing ? existing.lastAnswer : null,
        };
        await saveGameState(state);
        break;
      }

      case 'SUBMIT_ANSWER': {
        const { playerId, optionIndex } = body;
        const player = state.players[playerId];
        if (!player) {
          return NextResponse.json({ error: 'Jugador no registrado' }, { status: 400 });
        }
        if (state.phase !== 'PLAYING' || !state.activeRound) {
          return NextResponse.json({ error: 'La ronda ya no está activa' }, { status: 400 });
        }
        if (player.lastAnswer?.roundId === state.activeRound.roundId) {
          return NextResponse.json({ error: 'Ya respondiste en esta ronda' }, { status: 400 });
        }

        const roundStatus = computeRoundProgress(state.activeRound, now);
        if (roundStatus.isFinished) {
          return NextResponse.json({ error: '¡Se acabó el tiempo para votar!' }, { status: 400 });
        }

        const isCorrect = optionIndex === state.activeRound.correctOptionIndex;
        const speedRatio = Math.max(0, Math.min(1, 1 - roundStatus.progress));
        let pointsEarned = 0;
        if (isCorrect) {
          const basePoints = Math.round(500 + 500 * speedRatio);
          const newStreak = (player.streak || 0) + 1;
          const streakBonus = Math.min(300, (newStreak - 1) * 50);
          pointsEarned = basePoints + streakBonus;
          player.score = (player.score || 0) + pointsEarned;
          player.streak = newStreak;
        } else {
          player.streak = 0;
        }

        player.lastAnswer = {
          roundId: state.activeRound.roundId,
          optionIndex,
          answeredAt: now,
          elapsedMs: roundStatus.elapsedMs,
          isCorrect,
          pointsEarned,
        };

        await saveGameState(state);
        break;
      }

      // ================= ADMIN ACTIONS =================
      case 'ADD_PHOTOS_BATCH': {
        const { photos } = body;
        if (Array.isArray(photos)) {
          for (const item of photos) {
            if (!item.imageData) continue;
            state.photos.push({
              id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: (item.name || 'Personaje Misterioso').trim(),
              imageData: item.imageData,
              customDistractors: Array.isArray(item.customDistractors)
                ? item.customDistractors.filter(Boolean)
                : [],
              played: false,
            });
          }
          await saveGameState(state);
        }
        break;
      }

      case 'UPDATE_PHOTO': {
        const { photoId, name, customDistractors } = body;
        const photo = state.photos.find((p) => p.id === photoId);
        if (photo) {
          if (typeof name === 'string' && name.trim()) photo.name = name.trim();
          if (Array.isArray(customDistractors)) {
            photo.customDistractors = customDistractors.map((d) => d.trim()).filter(Boolean);
          }
          await saveGameState(state);
        }
        break;
      }

      case 'DELETE_PHOTO': {
        const { photoId } = body;
        state.photos = state.photos.filter((p) => p.id !== photoId);
        if (state.activeRound?.photoId === photoId) {
          state.activeRound = null;
          state.phase = 'LOBBY';
        }
        await saveGameState(state);
        break;
      }

      case 'CLEAR_ALL_PHOTOS': {
        state.photos = [];
        state.activeRound = null;
        state.phase = 'LOBBY';
        await saveGameState(state);
        break;
      }

      case 'START_ROUND': {
        const { photoId, durationSeconds, effectType } = body;
        let targetPhoto = state.photos.find((p) => p.id === photoId);
        if (!targetPhoto) {
          targetPhoto = state.photos.find((p) => !p.played) || state.photos[0];
        }
        if (!targetPhoto) {
          return NextResponse.json({ error: 'No hay fotos cargadas' }, { status: 400 });
        }

        const durationSec = Number(durationSeconds || state.settings.timerDuration || 15);
        const chosenEffect = effectType || state.settings.effectType || 'SWIRL_BLUR';
        const { options, correctOptionIndex } = generateOptionsForPhoto(targetPhoto, state.photos);

        state.activeRound = {
          roundId: `round-${now}`,
          photoId: targetPhoto.id,
          options,
          correctOptionIndex,
          startedAt: now,
          durationMs: durationSec * 1000,
          isPaused: false,
          pausedAt: null,
          totalPausedMs: 0,
          effectType: chosenEffect,
          manualProgress: null,
          showAudienceVotes: false,
        };
        state.phase = 'PLAYING';
        await saveGameState(state);
        break;
      }

      case 'TOGGLE_PAUSE': {
        if (state.activeRound && state.phase === 'PLAYING') {
          if (!state.activeRound.isPaused) {
            state.activeRound.isPaused = true;
            state.activeRound.pausedAt = now;
          } else {
            const pausedDuration = state.activeRound.pausedAt
              ? now - state.activeRound.pausedAt
              : 0;
            state.activeRound.totalPausedMs =
              (state.activeRound.totalPausedMs || 0) + pausedDuration;
            state.activeRound.isPaused = false;
            state.activeRound.pausedAt = null;
          }
          await saveGameState(state);
        }
        break;
      }

      case 'TOGGLE_AUDIENCE_VOTES': {
        // Lets the Admin show % of votes per option on TV BEFORE revealing which one is correct!
        if (state.activeRound) {
          state.activeRound.showAudienceVotes = !state.activeRound.showAudienceVotes;
          await saveGameState(state);
        }
        break;
      }

      case 'REVEAL_NOW': {
        if (state.activeRound) {
          state.phase = 'REVEALED';
          const photo = state.photos.find((p) => p.id === state.activeRound.photoId);
          if (photo) photo.played = true;
          await saveGameState(state);
        }
        break;
      }

      case 'SET_PHASE': {
        const { phase } = body;
        if (['LOBBY', 'PLAYING', 'REVEALED', 'RANKING'].includes(phase)) {
          state.phase = phase;
          if (phase === 'REVEALED' && state.activeRound) {
            const photo = state.photos.find((p) => p.id === state.activeRound.photoId);
            if (photo) photo.played = true;
          }
          await saveGameState(state);
        }
        break;
      }

      case 'UPDATE_SETTINGS': {
        const { settings } = body;
        if (settings && typeof settings === 'object') {
          state.settings = {
            ...state.settings,
            ...settings,
          };
          if (state.activeRound && settings.effectType) {
            state.activeRound.effectType = settings.effectType;
          }
          await saveGameState(state);
        }
        break;
      }

      case 'KICK_PLAYER': {
        const { playerId } = body;
        if (playerId && state.players[playerId]) {
          delete state.players[playerId];
          await saveGameState(state);
        }
        break;
      }

      case 'RESET_SCORES': {
        for (const id of Object.keys(state.players)) {
          state.players[id].score = 0;
          state.players[id].streak = 0;
          state.players[id].lastAnswer = null;
        }
        for (const p of state.photos) {
          p.played = false;
        }
        await saveGameState(state);
        break;
      }

      default:
        return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
    }

    const { payload } = buildClientPayload(state, body.role || 'admin', body.playerId);
    return NextResponse.json(payload);
  } catch (err) {
    console.error('Error in POST /api/game:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
