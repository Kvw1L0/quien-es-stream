import { NextResponse } from 'next/server';
import {
  getGameState,
  saveGameState,
  computeRoundProgress,
  generateOptionsForPhoto,
  inferGenderFromName,
} from '@/lib/gameStore';

export const dynamic = 'force-dynamic';

function buildClientPayload(state, role, playerId, options = {}) {
  const { knownPhotoId = null, includePhotosData = true } = options;
  const now = Date.now();
  let currentPhase = state.phase;
  let roundStatus = { progress: 0, remainingMs: 0, elapsedMs: 0, isFinished: false };

  let drumrollAutoCompleted = false;
  if (
    currentPhase === 'PLAYING' &&
    state.activeRound?.drumrollStartedAt &&
    now - state.activeRound.drumrollStartedAt >= 3000
  ) {
    currentPhase = 'REVEALED';
    drumrollAutoCompleted = true;
  }

  if (state.activeRound) {
    roundStatus = computeRoundProgress(state.activeRound, now);
  }

  const activePhoto = state.activeRound
    ? state.photos.find((p) => p.id === state.activeRound.photoId) || null
    : null;

  const isRevealed = currentPhase === 'REVEALED';
  const isTimeUp = currentPhase === 'PLAYING' && roundStatus.isFinished;

  const rawPlayersList = Object.values(state.players || {});
  const playersList = rawPlayersList
    .map((p) => {
      const hasCurrentRoundPoints =
        !isRevealed &&
        state.activeRound &&
        p.lastAnswer?.roundId === state.activeRound.roundId;
      const visibleScore =
        hasCurrentRoundPoints && role !== 'admin'
          ? Math.max(0, p.score - (p.lastAnswer?.pointsEarned || 0))
          : p.score;
      return {
        ...p,
        visibleScore,
      };
    })
    .sort((a, b) => {
      if (b.visibleScore !== a.visibleScore) return b.visibleScore - a.visibleScore;
      return (a.joinedAt || 0) - (b.joinedAt || 0);
    });

  const voteCounts = [0, 0, 0, 0];
  let totalVotes = 0;
  const roundResponders = [];
  let fastestCorrect = null;

  if (state.activeRound) {
    for (const p of rawPlayersList) {
      if (p.lastAnswer && p.lastAnswer.roundId === state.activeRound.roundId) {
        const idx = p.lastAnswer.optionIndex;
        if (idx >= 0 && idx < 4) {
          voteCounts[idx]++;
          totalVotes++;
        }
        roundResponders.push({
          id: p.id,
          name: p.name,
          emoji: p.emoji || '😎',
          avatarColor: p.avatarColor,
          answeredAt: p.lastAnswer.answeredAt,
        });

        if (p.lastAnswer.isCorrect) {
          if (!fastestCorrect || p.lastAnswer.elapsedMs < fastestCorrect.elapsedMs) {
            fastestCorrect = {
              id: p.id,
              name: p.name,
              emoji: p.emoji || '😎',
              avatarColor: p.avatarColor,
              elapsedMs: p.lastAnswer.elapsedMs,
              pointsEarned: p.lastAnswer.pointsEarned,
            };
          }
        }
      }
    }
  }

  roundResponders.sort((a, b) => b.answeredAt - a.answeredAt);

  const recentReactions = (state.reactions || []).filter(
    (r) => now - r.createdAt < 6000
  );

  const drumrollRemainingMs =
    currentPhase === 'PLAYING' && state.activeRound?.drumrollStartedAt
      ? Math.max(0, 3000 - (now - state.activeRound.drumrollStartedAt))
      : 0;

  const showOptionsOnTv = Boolean(state.activeRound?.showAudienceVotes);

  const basePayload = {
    version: state.version,
    serverNow: now,
    phase: currentPhase,
    settings: state.settings,
    playerCount: playersList.length,
    reactions: recentReactions,
    leaderboard: playersList.slice(0, 20).map((p, idx) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji || '😎',
      avatarColor: p.avatarColor,
      score: p.visibleScore,
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
          imageData:
            activePhoto && knownPhotoId !== state.activeRound.photoId
              ? activePhoto.imageData
              : undefined,
          correctName: isRevealed || role === 'admin' ? activePhoto?.name : null,
          options: state.activeRound.options,
          correctOptionIndex:
            isRevealed || role === 'admin' ? state.activeRound.correctOptionIndex : null,
          durationMs: state.activeRound.durationMs,
          isPaused: state.activeRound.isPaused,
          effectType: state.activeRound.effectType,
          pointsMultiplier: state.activeRound.pointsMultiplier || 1,
          manualProgress: state.activeRound.manualProgress,
          progress: isRevealed ? 1 : roundStatus.progress,
          remainingMs: isRevealed ? 0 : roundStatus.remainingMs,
          elapsedMs: roundStatus.elapsedMs,
          isTimeUp,
          isDrumrolling: drumrollRemainingMs > 0,
          drumrollRemainingMs,
          hintText: state.activeRound.hintText || activePhoto?.hint || '',
          showHintOnTv: Boolean(state.activeRound.showHintOnTv),
          recentResponders: roundResponders.slice(0, 8),
          fastestWinner: isRevealed || role === 'admin' ? fastestCorrect : null,
          showAudienceVotes: showOptionsOnTv,
          voteCounts:
            isRevealed || role === 'admin' || showOptionsOnTv
              ? voteCounts
              : null,
          totalVotes,
        }
      : null,
  };

  if (role === 'admin') {
    basePayload.photos = includePhotosData
      ? state.photos
      : state.photos.map(({ imageData, ...meta }) => meta);
    basePayload.allPlayers = playersList;
  }

  if (playerId && state.players[playerId]) {
    const me = state.players[playerId];
    const sanitizedLastAnswer = me.lastAnswer
      ? {
          roundId: me.lastAnswer.roundId,
          optionIndex: me.lastAnswer.optionIndex,
          answeredAt: me.lastAnswer.answeredAt,
          isCorrect: isRevealed ? me.lastAnswer.isCorrect : null,
          pointsEarned: isRevealed ? me.lastAnswer.pointsEarned : null,
          hasReacted: Boolean(me.lastAnswer.hasReacted),
        }
      : null;

    basePayload.me = {
      id: me.id,
      name: me.name,
      emoji: me.emoji || '😎',
      avatarColor: me.avatarColor,
      lastAnswer: sanitizedLastAnswer,
    };
  }

  return { payload: basePayload, drumrollAutoCompleted };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role') || 'player';
  const playerId = searchParams.get('playerId') || null;
  const knownPhotoId = searchParams.get('knownPhotoId') || null;
  const includePhotosData = searchParams.get('includePhotosData') !== '0';

  const state = await getGameState();
  const { payload, drumrollAutoCompleted } = buildClientPayload(state, role, playerId, {
    knownPhotoId,
    includePhotosData,
  });

  if (drumrollAutoCompleted) {
    state.phase = 'REVEALED';
    if (state.activeRound) {
      state.activeRound.drumrollStartedAt = null;
      const photo = state.photos.find((p) => p.id === state.activeRound.photoId);
      if (photo) photo.played = true;
    }
    await saveGameState(state);
  }

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
        const { playerId, name, emoji, avatarColor } = body;
        if (!playerId || !name || !name.trim()) {
          return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });
        }
        const cleanName = name.trim().slice(0, 18);
        const existing = state.players[playerId];
        state.players[playerId] = {
          id: playerId,
          name: cleanName,
          emoji: emoji || existing?.emoji || '😎',
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

        const roundStatus = computeRoundProgress(state.activeRound, now);
        if (roundStatus.isFinished) {
          return NextResponse.json({ error: '¡Se acabó el tiempo para votar!' }, { status: 400 });
        }

        const prevAnswerForThisRound =
          player.lastAnswer?.roundId === state.activeRound.roundId
            ? player.lastAnswer
            : null;

        const baseScoreBeforeRound = prevAnswerForThisRound
          ? typeof prevAnswerForThisRound.baseScore === 'number'
            ? prevAnswerForThisRound.baseScore
            : Math.max(0, (player.score || 0) - (prevAnswerForThisRound.pointsEarned || 0))
          : player.score || 0;

        const baseStreakBeforeRound = prevAnswerForThisRound
          ? typeof prevAnswerForThisRound.baseStreak === 'number'
            ? prevAnswerForThisRound.baseStreak
            : 0
          : player.streak || 0;

        const isCorrect = optionIndex === state.activeRound.correctOptionIndex;
        const speedRatio = Math.max(0, Math.min(1, 1 - roundStatus.progress));
        const multiplier = Number(state.activeRound.pointsMultiplier || 1);
        let pointsEarned = 0;

        if (isCorrect) {
          const basePoints = Math.round((500 + 500 * speedRatio) * multiplier);
          const newStreak = baseStreakBeforeRound + 1;
          const streakBonus = Math.min(300, (newStreak - 1) * 50) * multiplier;
          pointsEarned = basePoints + streakBonus;
          player.score = baseScoreBeforeRound + pointsEarned;
          player.streak = newStreak;
        } else {
          player.score = baseScoreBeforeRound;
          player.streak = 0;
        }

        player.lastAnswer = {
          roundId: state.activeRound.roundId,
          optionIndex,
          answeredAt: now,
          elapsedMs: roundStatus.elapsedMs,
          isCorrect,
          pointsEarned,
          baseScore: baseScoreBeforeRound,
          baseStreak: baseStreakBeforeRound,
          hasReacted: Boolean(prevAnswerForThisRound?.hasReacted),
        };

        await saveGameState(state);
        break;
      }

      case 'SEND_REACTION': {
        const { playerId, emoji } = body;
        const allowedEmojis = ['🔥', '😂', '🤯', '👏', '❤️', '🎉'];
        if (!allowedEmojis.includes(emoji)) break;
        const player = state.players[playerId];
        if (!player || !state.activeRound) break;

        if (
          !player.lastAnswer ||
          player.lastAnswer.roundId !== state.activeRound.roundId ||
          player.lastAnswer.hasReacted
        ) {
          break;
        }

        player.lastAnswer.hasReacted = true;

        if (!Array.isArray(state.reactions)) state.reactions = [];
        state.reactions.push({
          id: `rx-${now}-${Math.random().toString(36).slice(2, 6)}`,
          emoji,
          playerName: player.name || 'Espectador',
          playerEmoji: player.emoji || '😎',
          avatarColor: player.avatarColor || '#008296',
          createdAt: now,
          offsetLeft: Math.floor(15 + Math.random() * 70),
        });
        await saveGameState(state);
        break;
      }

      // ================= ADMIN ACTIONS =================
      case 'ADD_PHOTOS_BATCH': {
        const { photos } = body;
        if (Array.isArray(photos)) {
          for (const item of photos) {
            if (!item.imageData) continue;
            const cleanName = (item.name || 'Personaje Misterioso').trim();
            state.photos.push({
              id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: cleanName,
              gender: item.gender || inferGenderFromName(cleanName),
              hint: (item.hint || '').trim(),
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
        const { photoId, name, gender, hint, customDistractors } = body;
        const photo = state.photos.find((p) => p.id === photoId);
        if (photo) {
          if (typeof name === 'string' && name.trim()) photo.name = name.trim();
          if (gender === 'M' || gender === 'F') photo.gender = gender;
          if (typeof hint === 'string') photo.hint = hint.trim();
          if (Array.isArray(customDistractors)) {
            photo.customDistractors = customDistractors.map((d) => d.trim()).filter(Boolean);
          }
          if (state.activeRound?.photoId === photoId && typeof hint === 'string') {
            state.activeRound.hintText = hint.trim();
          }
          await saveGameState(state);
        }
        break;
      }

      case 'TOGGLE_PHOTO_GENDER': {
        const { photoId } = body;
        const photo = state.photos.find((p) => p.id === photoId);
        if (photo) {
          const current = photo.gender || inferGenderFromName(photo.name);
          photo.gender = current === 'F' ? 'M' : 'F';
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
        const { photoId, durationSeconds, effectType, pointsMultiplier } = body;
        let targetPhoto = state.photos.find((p) => p.id === photoId);
        if (!targetPhoto) {
          targetPhoto = state.photos.find((p) => !p.played) || state.photos[0];
        }
        if (!targetPhoto) {
          return NextResponse.json({ error: 'No hay fotos cargadas' }, { status: 400 });
        }

        const durationSec = Number(durationSeconds || state.settings.timerDuration || 15);
        const chosenEffect = effectType || state.settings.effectType || 'SWIRL_BLUR';
        const mult = Number(pointsMultiplier || state.settings.pointsMultiplier || 1);
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
          pointsMultiplier: mult,
          manualProgress: null,
          showAudienceVotes: false,
          hintText: targetPhoto.hint || '',
          showHintOnTv: false,
          drumrollStartedAt: null,
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

      case 'SET_MANUAL_PROGRESS': {
        const { progress } = body;
        if (state.activeRound) {
          if (progress === null || typeof progress === 'undefined') {
            state.activeRound.manualProgress = null;
          } else {
            state.activeRound.manualProgress = Math.max(0, Math.min(1, Number(progress)));
          }
          await saveGameState(state);
        }
        break;
      }

      case 'TOGGLE_HINT': {
        const { customHintText } = body;
        if (state.activeRound) {
          if (typeof customHintText === 'string') {
            state.activeRound.hintText = customHintText.trim();
          }
          state.activeRound.showHintOnTv = !state.activeRound.showHintOnTv;
          await saveGameState(state);
        }
        break;
      }

      case 'UPDATE_LIVE_HINT': {
        const { hintText, showHintOnTv } = body;
        if (state.activeRound) {
          if (typeof hintText === 'string') {
            state.activeRound.hintText = hintText.trim();
          }
          if (typeof showHintOnTv === 'boolean') {
            state.activeRound.showHintOnTv = showHintOnTv;
          }
          await saveGameState(state);
        }
        break;
      }

      case 'TOGGLE_AUDIENCE_VOTES': {
        if (state.activeRound) {
          state.activeRound.showAudienceVotes = !state.activeRound.showAudienceVotes;
          await saveGameState(state);
        }
        break;
      }

      case 'START_DRUMROLL_REVEAL': {
        if (state.activeRound && state.phase === 'PLAYING') {
          state.activeRound.drumrollStartedAt = now;
          await saveGameState(state);
        }
        break;
      }

      case 'REVEAL_NOW': {
        if (state.activeRound) {
          state.activeRound.drumrollStartedAt = null;
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
            state.activeRound.drumrollStartedAt = null;
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
          if (state.activeRound) {
            if (settings.effectType) {
              state.activeRound.effectType = settings.effectType;
            }
            if (settings.pointsMultiplier) {
              state.activeRound.pointsMultiplier = Number(settings.pointsMultiplier);
            }
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

      case 'CLOSE_SESSION': {
        // Expels all players from the room, resets active round, reactions, and played flags, returning to LOBBY
        state.players = {};
        state.reactions = [];
        state.activeRound = null;
        state.phase = 'LOBBY';
        for (const p of state.photos) {
          p.played = false;
        }
        await saveGameState(state);
        break;
      }

      default:
        return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
    }

    const photoMutatingActions = new Set([
      'ADD_PHOTOS_BATCH',
      'DELETE_PHOTO',
      'CLEAR_ALL_PHOTOS',
    ]);
    const { payload } = buildClientPayload(state, body.role || 'admin', body.playerId, {
      knownPhotoId: body.knownPhotoId || null,
      includePhotosData: photoMutatingActions.has(action),
    });
    return NextResponse.json(payload);
  } catch (err) {
    console.error('Error in POST /api/game:', err);
    return NextResponse.json({ error: err.message || 'Error interno' }, { status: 500 });
  }
}
