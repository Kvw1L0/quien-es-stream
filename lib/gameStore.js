import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis = (redisUrl && redisToken)
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

const STATE_KEY = 'quien_es_stream_state_v1';

export const FALLBACK_NAMES_MALE = [
  'Lionel Messi',
  'Pedro Pascal',
  'Bad Bunny',
  'Cristiano Ronaldo',
  'Elon Musk',
  'Keanu Reeves',
  'Guillermo del Toro',
  'Brad Pitt',
  'Leonardo DiCaprio',
  'Tom Cruise',
  'Chayanne',
  'Daddy Yankee',
];

export const FALLBACK_NAMES_FEMALE = [
  'Shakira',
  'Taylor Swift',
  'Rosalía',
  'Zendaya',
  'Karol G',
  'Beyoncé',
  'Lady Gaga',
  'Adele',
  'Selena Gomez',
  'Rihanna',
  'Dua Lipa',
  'Jennifer Lopez',
];

const KNOWN_FEMALE_FIRST_NAMES = new Set([
  'shakira', 'taylor', 'rosalia', 'rosalía', 'zendaya', 'karol', 'beyonce', 'beyoncé',
  'lady', 'adele', 'selena', 'rihanna', 'dua', 'jennifer', 'camila', 'maria', 'maría',
  'carmen', 'ana', 'lucia', 'lucía', 'sofia', 'sofía', 'martina', 'catalina', 'elena',
  'laura', 'paula', 'valentina', 'javiera', 'francisca', 'constanza', 'fernanda', 'daniela',
  'gabriela', 'alejandra', 'carolina', 'andrea', 'natalia', 'valeria', 'victoria', 'isabella',
  'antonella', 'josefa', 'florencia', 'trinidad', 'amanda', 'maite', 'emilia', 'agustina',
  'cecilia', 'diana', 'karen', 'tonka', 'pamela', 'raquel', 'myriam', 'mon', 'paloma',
  'denise', 'priscilla', 'soledad', 'macarena', 'mane', 'mané', 'sigrid', 'paola', 'ingrid',
  'bachelet', 'michelle', 'evelyn', 'cathy', 'camila', 'karla', 'carla', 'claudia', 'patricia',
  'veronica', 'verónica', 'monica', 'mónica', 'silvia', 'rosa', 'teresa', 'beatriz', 'rocio',
  'rocío', 'blanca', 'pilar', 'isabel', 'leticia', 'sara', 'eva', 'julia', 'clara', 'ines',
  'inés', 'irene', 'olga', 'marta', 'lorena', 'alicia', 'marina', 'susana', 'miriam', 'nuria',
  'cristina', 'barbara', 'bárbara', 'ariana', 'billie', 'miley', 'katy', 'madonna', 'britney',
  'scarlett', 'margot', 'emma', 'anne', 'angelina', 'natalie', 'gal', 'salma', 'penelope',
  'penélope', 'becky', 'nicki', 'cardi', 'anitta', 'tini', 'emilia', 'nicki', 'cazzu',
  'danna', 'belinda', 'thalia', 'thalía', 'paulina', 'gloria', 'celia', 'mercedes', 'violeta',
]);

const KNOWN_MALE_FIRST_NAMES = new Set([
  'lionel', 'pedro', 'bad', 'cristiano', 'elon', 'keanu', 'guillermo', 'brad', 'leonardo',
  'tom', 'chayanne', 'daddy', 'ibai', 'juan', 'carlos', 'jose', 'josé', 'luis', 'miguel',
  'jorge', 'francisco', 'antonio', 'manuel', 'david', 'daniel', 'javier', 'alejando', 'alejandro',
  'fernando', 'sergio', 'pablo', 'andres', 'andrés', 'matias', 'matías', 'diego', 'sebastian',
  'sebastián', 'nicolas', 'nicolás', 'felipe', 'cristian', 'cristián', 'rodrigo', 'gonzalo',
  'claudio', 'patricio', 'mauricio', 'eduardo', 'ricardo', 'roberto', 'mario', 'raul', 'raúl',
  'arturo', 'alvaro', 'álvaro', 'gustavo', 'marcelo', 'julio', 'cesar', 'césar', 'oscar', 'óscar',
  'ivan', 'iván', 'hector', 'héctor', 'jaime', 'hernan', 'hernán', 'gabriel', 'boric', 'piñera',
  'alexis', 'gary', 'charles', 'ben', 'benjamin', 'benjamín', 'vicente', 'martin', 'martín',
  'tomas', 'tomás', 'lucas', 'mateo', 'joaquin', 'joaquín', 'maximiliano', 'alonso', 'agustin',
  'agustín', 'bruno', 'ante', 'pancho', 'lucho', 'pepe', 'coco', 'bombo', 'stefan', 'kramer',
  'fabrizio', 'edo', 'jc', 'vodanovic', 'don', 'rafael', 'araneda', 'zabaleta', 'camilo',
]);

export function inferGenderFromName(rawName = '') {
  const clean = rawName.trim().toLowerCase();
  if (!clean) return 'M';
  const words = clean.split(/\s+/);
  const firstWord = words[0];

  if (KNOWN_FEMALE_FIRST_NAMES.has(firstWord)) return 'F';
  if (KNOWN_MALE_FIRST_NAMES.has(firstWord)) return 'M';

  for (const w of words) {
    if (KNOWN_FEMALE_FIRST_NAMES.has(w)) return 'F';
    if (KNOWN_MALE_FIRST_NAMES.has(w)) return 'M';
  }

  // Heuristic for Spanish first names ending in 'a' (excluding common male exceptions like luca, borja, nikola)
  if (firstWord.endsWith('a') && !['borja', 'luca', 'nikola', 'mustafa', 'joshua'].includes(firstWord)) {
    return 'F';
  }
  return 'M';
}

function createDemoPhotoSvg(bg1, bg2, emoji) {
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
      timerDuration: 15,
      effectType: 'SWIRL_BLUR',
      chromaMode: 'DARK',
      showQrOnTv: true,
      soundEnabled: true,
      pointsMultiplier: 1,
      customJoinUrl: '',
    },
    photos: [
      {
        id: 'demo-1',
        name: 'Lionel Messi',
        gender: 'M',
        hint: 'Campeón del Mundo en Qatar 2022',
        imageData: createDemoPhotoSvg('#008296', '#005566', '🐐'),
        customDistractors: ['Cristiano Ronaldo', 'Ángel Di María', 'Neymar Jr'],
        played: false,
      },
      {
        id: 'demo-2',
        name: 'Pedro Pascal',
        gender: 'M',
        hint: 'Actor chileno protagonista de The Last of Us y The Mandalorian',
        imageData: createDemoPhotoSvg('#e5a93c', '#b8740a', '🤠'),
        customDistractors: ['Oscar Isaac', 'Diego Luna', 'Gael García'],
        played: false,
      },
      {
        id: 'demo-3',
        name: 'Shakira',
        gender: 'F',
        hint: 'Cantante colombiana autora de Pies Descalzos',
        imageData: createDemoPhotoSvg('#84bd00', '#005566', '🎤'),
        customDistractors: ['Karol G', 'Rosalía', 'Jennifer Lopez'],
        played: false,
      }
    ],
    activeRound: null,
    players: {},
    reactions: [],
  };
}

if (!globalThis.__QUIEN_ES_STATE__) {
  globalThis.__QUIEN_ES_STATE__ = getInitialState();
}

export async function getGameState() {
  if (redis) {
    try {
      const data = await redis.get(STATE_KEY);
      if (data) {
        if (!Array.isArray(data.reactions)) data.reactions = [];
        if (!data.settings.pointsMultiplier) data.settings.pointsMultiplier = 1;
        // Backfill gender on any existing photos in Redis
        if (Array.isArray(data.photos)) {
          for (const p of data.photos) {
            if (!p.gender) p.gender = inferGenderFromName(p.name);
          }
        }
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
  if (Array.isArray(newState.reactions)) {
    newState.reactions = newState.reactions
      .filter((r) => newState.updatedAt - r.createdAt < 8000)
      .slice(-30);
  } else {
    newState.reactions = [];
  }

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
    const effectiveNow = activeRound.isPaused && activeRound.pausedAt ? activeRound.pausedAt : now;
    const realElapsedMs = Math.max(0, effectiveNow - activeRound.startedAt - (activeRound.totalPausedMs || 0));
    const remMs = Math.max(0, activeRound.durationMs - realElapsedMs);
    return {
      progress: p,
      remainingMs: remMs,
      elapsedMs: realElapsedMs,
      isFinished: remMs <= 0 && !activeRound.isPaused,
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
  const targetGender = photo.gender || inferGenderFromName(correctName);
  const distractors = [];

  // 1. Custom manual distractors if specified
  if (Array.isArray(photo.customDistractors)) {
    for (const d of photo.customDistractors) {
      if (d && d.trim() && d.trim().toLowerCase() !== correctName.toLowerCase()) {
        distractors.push(d.trim());
      }
    }
  }

  // 2. Pull ONLY from other photos in the batch that share the SAME GENDER ('M' or 'F')
  if (distractors.length < 3) {
    const sameGenderBatchNames = allPhotos
      .filter((p) => {
        if (p.id === photo.id) return false;
        if (p.name.trim().toLowerCase() === correctName.toLowerCase()) return false;
        const pGender = p.gender || inferGenderFromName(p.name);
        return pGender === targetGender;
      })
      .map((p) => p.name.trim());

    const shuffledBatch = [...sameGenderBatchNames].sort(() => Math.random() - 0.5);
    for (const name of shuffledBatch) {
      if (distractors.length >= 3) break;
      if (!distractors.some((d) => d.toLowerCase() === name.toLowerCase())) {
        distractors.push(name);
      }
    }
  }

  // 3. Fallback pool strictly matching the photo's gender ('M' or 'F')
  if (distractors.length < 3) {
    const fallbackPool = targetGender === 'F' ? FALLBACK_NAMES_FEMALE : FALLBACK_NAMES_MALE;
    const shuffledFallback = [...fallbackPool].sort(() => Math.random() - 0.5);
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
