import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis = (redisUrl && redisToken)
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

const STATE_KEY = 'quien_es_stream_state_v1';

export const DEFAULT_FALLBACK_NAMES = [
  'Lionel Messi',
  'Pedro Pascal',
  'Bad Bunny',
  'Shakira',
  'Ibai Llanos',
  'Cristiano Ronaldo',
  'Taylor Swift',
  'Elon Musk',
  'Keanu Reeves',
  'Rosalía',
  'Zendaya',
  'Guillermo del Toro'
];

// Create default SVG avatars as data URLs for immediate out-of-the-box demo
function createDemoPhotoSvg(bg1, bg2, emoji, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bg1}"/>
        <stop offset="100%" stop-color="${bg2}"/>
      </linearGradient>
    </defs>
    <rect width="600" height="600" fill="url(#g)"/>
    <circle cx="300" cy="240" r="110" fill="rgba(255,255,255,0.2)"/>
    <path d="M140 540 C140 390 460 390 460 540" fill="rgba(255,255,255,0.2)"/>
    <text x="300" y="295" font-size="150" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function getInitialState() {
  return {
    version: 1,
    updatedAt: Date.now(),
    phase: 'LOBBY', // 'LOBBY' | 'PLAYING' | 'REVEALED' | 'RANKING'
    settings: {
      timerDuration: 15, // seconds
      effectType: 'SWIRL_BLUR', // 'PIXELATE' | 'BLUR' | 'SWIRL_BLUR' | 'ZOOM'
      chromaMode: 'DARK', // 'DARK' | 'TRANSPARENT' | 'GREEN'
      showQrOnTv: true,
      soundEnabled: true,
      customJoinUrl: '',
    },
    photos: [
      {
        id: 'demo-1',
        name: 'Lionel Messi',
        imageData: createDemoPhotoSvg('#0ea5e9', '#1e3a8a', '🐐', 'Messi'),
        customDistractors: ['Cristiano Ronaldo', 'Ángel Di María', 'Neymar Jr'],
        played: false,
      },
      {
        id: 'demo-2',
        name: 'Pedro Pascal',
        imageData: createDemoPhotoSvg('#f59e0b', '#7c2d12', '🤠', 'Pascal'),
        customDistractors: ['Oscar Isaac', 'Diego Luna', 'Gael García'],
        played: false,
      },
      {
        id: 'demo-3',
        name: 'Bad Bunny',
        imageData: createDemoPhotoSvg('#ec4899', '#581c87', '🐰', 'Bad Bunny'),
        customDistractors: ['J Balvin', 'Rauw Alejandro', 'Daddy Yankee'],
        played: false,
      }
    ],
    activeRound: null,
    /*
      activeRound: {
        roundId: string,
        photoId: string,
        options: [string, string, string, string],
        correctOptionIndex: number, // 0..3
        startedAt: number,
        durationMs: number,
        isPaused: boolean,
        pausedAt: number | null,
        totalPausedMs: number,
        effectType: string,
        manualProgress: number | null, // optional admin override 0..1
      }
    */
    players: {},
    /*
      players[playerId] = {
        id: string,
        name: string,
        avatarColor: string,
        score: number,
        streak: number,
        joinedAt: number,
        lastAnswer: {
          roundId: string,
          optionIndex: number,
          answeredAt: number,
          elapsedMs: number,
          isCorrect: boolean,
          pointsEarned: number,
        } | null
      }
    */
  };
}

// Global memory store fallback
if (!globalThis.__QUIEN_ES_STATE__) {
  globalThis.__QUIEN_ES_STATE__ = getInitialState();
}

export async function getGameState() {
  if (redis) {
    try {
      const data = await redis.get(STATE_KEY);
      if (data) {
        return data;
      }
      const initial = getInitialState();
      await redis.set(STATE_KEY, initial);
      return initial;
    } catch (err) {
      console.error('Redis read error, falling back to memory:', err);
    }
  }
  return globalThis.__QUIEN_ES_STATE__;
}

export async function saveGameState(newState) {
  newState.updatedAt = Date.now();
  newState.version = (newState.version || 0) + 1;
  globalThis.__QUIEN_ES_STATE__ = newState;

  if (redis) {
    try {
      await redis.set(STATE_KEY, newState);
    } catch (err) {
      console.error('Redis write error:', err);
    }
  }
  return newState;
}

export function computeRoundProgress(activeRound, now = Date.now()) {
  if (!activeRound) return { progress: 0, remainingMs: 0, elapsedMs: 0, isFinished: false };
  if (typeof activeRound.manualProgress === 'number') {
    const p = Math.max(0, Math.min(1, activeRound.manualProgress));
    return {
      progress: p,
      remainingMs: Math.round((1 - p) * activeRound.durationMs),
      elapsedMs: Math.round(p * activeRound.durationMs),
      isFinished: p >= 1,
    };
  }

  const effectiveNow = activeRound.isPaused && activeRound.pausedAt ? activeRound.pausedAt : now;
  const elapsedMs = Math.max(0, effectiveNow - activeRound.startedAt - (activeRound.totalPausedMs || 0));
  const remainingMs = Math.max(0, activeRound.durationMs - elapsedMs);
  const progress = activeRound.durationMs > 0
    ? Math.max(0, Math.min(1, elapsedMs / activeRound.durationMs))
    : 1;

  return {
    progress,
    remainingMs,
    elapsedMs,
    isFinished: remainingMs <= 0 && !activeRound.isPaused,
  };
}

export function generateOptionsForPhoto(photo, allPhotos) {
  const correctName = photo.name.trim();
  const distractors = [];

  // 1. Check custom distractors first
  if (Array.isArray(photo.customDistractors)) {
    for (const d of photo.customDistractors) {
      if (d && d.trim() && d.trim().toLowerCase() !== correctName.toLowerCase()) {
        distractors.push(d.trim());
      }
    }
  }

  // 2. If we still need more, pull from other photos in the batch
  if (distractors.length < 3) {
    const otherBatchNames = allPhotos
      .filter((p) => p.id !== photo.id && p.name.trim().toLowerCase() !== correctName.toLowerCase())
      .map((p) => p.name.trim());

    // Shuffle other batch names
    const shuffledBatch = [...otherBatchNames].sort(() => Math.random() - 0.5);
    for (const name of shuffledBatch) {
      if (distractors.length >= 3) break;
      if (!distractors.some((d) => d.toLowerCase() === name.toLowerCase())) {
        distractors.push(name);
      }
    }
  }

  // 3. Fallback pool if batch has fewer than 4 photos
  if (distractors.length < 3) {
    const shuffledFallback = [...DEFAULT_FALLBACK_NAMES].sort(() => Math.random() - 0.5);
    for (const name of shuffledFallback) {
      if (distractors.length >= 3) break;
      if (
        name.toLowerCase() !== correctName.toLowerCase() &&
        !distractors.some((d) => d.toLowerCase() === name.toLowerCase())
      ) {
        distractors.push(name);
      }
    }
  }

  const finalDistractors = distractors.slice(0, 3);
  const allOptions = [correctName, ...finalDistractors];

  // Shuffle options deterministically or randomly when starting round
  const shuffled = allOptions
    .map((value) => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);

  const correctOptionIndex = shuffled.findIndex(
    (opt) => opt.toLowerCase() === correctName.toLowerCase()
  );

  return {
    options: shuffled,
    correctOptionIndex: correctOptionIndex >= 0 ? correctOptionIndex : 0,
  };
}
