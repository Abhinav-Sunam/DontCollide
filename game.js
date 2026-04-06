const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const ui = {
  body: document.body,
  hint: document.getElementById("hint"),
  musicControls: document.getElementById("music-controls"),
  loadingScreen: document.getElementById("loading-screen"),
  loadingCopy: document.getElementById("loading-copy"),
  loadingBar: document.getElementById("loading-bar"),
  startScreen: document.getElementById("start-screen"),
  modeScreen: document.getElementById("mode-screen"),
  sideScreen: document.getElementById("side-screen"),
  modeMessage: document.getElementById("mode-message"),
  startPlay: document.getElementById("start-play"),
  modeLocal: document.getElementById("mode-local"),
  modeSingle: document.getElementById("mode-single"),
  modeOnline: document.getElementById("mode-online"),
  modeBack: document.getElementById("mode-back"),
  sideLeft: document.getElementById("side-left"),
  sideRight: document.getElementById("side-right"),
  sideBack: document.getElementById("side-back"),
  difficultyScreen: document.getElementById("difficulty-screen"),
  difficultyCopy: document.getElementById("difficulty-copy"),
  difficultyEasy: document.getElementById("difficulty-easy"),
  difficultyMedium: document.getElementById("difficulty-medium"),
  difficultyHard: document.getElementById("difficulty-hard"),
  difficultyBack: document.getElementById("difficulty-back"),
  musicStatus: document.getElementById("music-status"),
  musicDown: document.getElementById("music-down"),
  musicUp: document.getElementById("music-up"),
  musicToggle: document.getElementById("music-toggle"),
  musicStop: document.getElementById("music-stop"),
  touchControls: document.getElementById("touch-controls"),
  touchJoystick: document.getElementById("touch-joystick"),
  touchJoystickStick: document.getElementById("touch-joystick-stick"),
  touchGameoverActions: document.getElementById("touch-gameover-actions"),
  touchRestart: document.getElementById("touch-restart"),
  touchMenu: document.getElementById("touch-menu"),
};

const SCREEN_WIDTH = 1512;
const SCREEN_HEIGHT = 982;
const PLAYER_SIZE = 75;
const GEM_SIZE = 25;
const HUMAN_SPEED = 300;
const GEM_SPAWN_MIN_MS = 3000;
const GEM_SPAWN_MAX_MS = 5000;
const MENU_PREVIEW_GEMS = 4;
const TOUCH_JOYSTICK_DEAD_ZONE = 0.18;
const TOUCH_JOYSTICK_TRAVEL_RATIO = 0.24;
const LOGO_RECT = { x: (SCREEN_WIDTH - 750) / 2, y: 10, w: 750, h: 188 };
const ARENA_CENTER = { x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 };
const ROCK_TEMPLATES = [
  { x: 552, y: 294, w: 98, h: 82, variant: 0 },
  { x: 1116, y: 314, w: 104, h: 88, variant: 1 },
  { x: 168, y: 726, w: 112, h: 92, variant: 2 },
  { x: 1108, y: 748, w: 118, h: 96, variant: 3 },
];
const VISUAL_ASSET_SOURCES = {
  map: "map1.png",
  player1: "player1.png",
  player2: "player2.png",
  gem: "gem.png",
  logo: "logo.png",
};
const AI_DIFFICULTIES = {
  easy: {
    label: "Easy",
    speed: 248,
    contestWeight: 0.4,
    deniedPenalty: 18,
    comebackWeight: 0.05,
    cautionRadius: 214,
    avoidWhenLeading: 1.2,
    avoidWhenTrailing: 1.45,
    pressureRadius: 220,
    leadCautionPenalty: 22,
    bodyBlockWeight: 0.16,
    rockAvoidRadius: 68,
    rockAvoidStrength: 1.1,
    rockComfortRadius: 88,
    rockPenaltyWeight: 0.08,
    rockSafetyPadding: 8,
    rockLookaheadSec: 0.34,
  },
  medium: {
    label: "Medium",
    speed: 306,
    contestWeight: 0.62,
    deniedPenalty: 28,
    comebackWeight: 0.12,
    cautionRadius: 190,
    avoidWhenLeading: 0.55,
    avoidWhenTrailing: 1.15,
    pressureRadius: 170,
    leadCautionPenalty: 16,
    bodyBlockWeight: 0.3,
    rockAvoidRadius: 102,
    rockAvoidStrength: 1.45,
    rockComfortRadius: 112,
    rockPenaltyWeight: 0.13,
    rockSafetyPadding: 12,
    rockLookaheadSec: 0.42,
  },
  hard: {
    label: "Hard",
    speed: 344,
    contestWeight: 0.84,
    deniedPenalty: 38,
    comebackWeight: 0.21,
    cautionRadius: 176,
    avoidWhenLeading: 0.42,
    avoidWhenTrailing: 0.92,
    pressureRadius: 146,
    leadCautionPenalty: 10,
    bodyBlockWeight: 0.46,
    rockAvoidRadius: 132,
    rockAvoidStrength: 1.95,
    rockComfortRadius: 140,
    rockPenaltyWeight: 0.2,
    rockSafetyPadding: 16,
    rockLookaheadSec: 0.52,
  },
};

const state = {
  appMode: "loading",
  assetsReady: false,
  loading: {
    loaded: 0,
    total: Object.keys(VISUAL_ASSET_SOURCES).length,
  },
  gameMode: null,
  singlePlayerSide: "left",
  singlePlayerDifficulty: "medium",
  player1: makePlayer("left"),
  player2: makePlayer("right"),
  gems: [],
  rocks: [],
  score: { p1: 0, p2: 0 },
  gameOverReason: "",
  roundWinnerSide: null,
  gemSpawnTimerMs: 0,
  nextGemSpawnMs: 0,
  aiTargetGemIndex: -1,
  menuMessage: "",
};

const keys = new Set();
let audioContext = null;
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
const touchState = {
  available: false,
  active: false,
  pointerId: null,
  center: { x: 0, y: 0 },
  maxStickPx: 0,
  vector: { x: 0, y: 0 },
  stickOffset: { x: 0, y: 0 },
};

const music = {
  audio: new Audio("song.mp3"),
  volume: 0.1,
  available: true,
  stoppedByUser: false,
  userPaused: false,
};

const assets = Object.fromEntries(
  Object.entries(VISUAL_ASSET_SOURCES).map(([key, src]) => [key, createTrackedImage(src)])
);
const rockSprites = Array.from({ length: 4 }, (_, index) => createRockSprite(index + 1));

function createTrackedImage(src) {
  const image = new Image();
  const markResolved = () => {
    state.loading.loaded += 1;
    updateLoadingUi();
    if (state.loading.loaded >= state.loading.total) {
      finishLoading();
    }
  };

  image.addEventListener("load", markResolved, { once: true });
  image.addEventListener("error", markResolved, { once: true });
  image.src = src;
  return image;
}

function pseudoNoise(seed, x, y) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function createRockSprite(seed) {
  const pixelSize = 4;
  const gridSize = 16;
  const sprite = document.createElement("canvas");
  sprite.width = gridSize * pixelSize;
  sprite.height = gridSize * pixelSize;

  const spriteCtx = sprite.getContext("2d");
  spriteCtx.imageSmoothingEnabled = false;

  const palette = {
    outline: "#303745",
    dark: "#4a5567",
    mid: "#69758a",
    light: "#94a0b2",
    moss: "#6f8655",
  };

  const cx = 7.5 + (pseudoNoise(seed, 1, 2) - 0.5) * 1.5;
  const cy = 7.8 + (pseudoNoise(seed, 2, 3) - 0.5) * 1.3;
  const rx = 4.9 + pseudoNoise(seed, 3, 4) * 1.4;
  const ry = 4.1 + pseudoNoise(seed, 4, 5) * 1.3;
  const filled = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      const wobble = (pseudoNoise(seed, x, y) - 0.5) * 0.26;
      filled[y][x] = dx * dx + dy * dy + wobble < 1;
    }
  }

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      if (!filled[y][x]) continue;

      const isEdge =
        x === 0 ||
        y === 0 ||
        x === gridSize - 1 ||
        y === gridSize - 1 ||
        !filled[y][x - 1] ||
        !filled[y][x + 1] ||
        !filled[y - 1]?.[x] ||
        !filled[y + 1]?.[x];

      let color = palette.mid;
      if (isEdge) {
        color = palette.outline;
      } else if (y < cy - 1.5 && pseudoNoise(seed + 9, x, y) > 0.64) {
        color = palette.moss;
      } else if (x + y < cx + cy + pseudoNoise(seed + 14, x, y) * 2.3) {
        color = palette.light;
      } else if (y > cy + 1.2) {
        color = palette.dark;
      }

      spriteCtx.fillStyle = color;
      spriteCtx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
    }
  }

  return sprite;
}

function makePlayer(side) {
  const start = side === "left" ? { x: 200, y: 250 } : { x: 400, y: 250 };
  return { side, x: start.x, y: start.y, w: PLAYER_SIZE, h: PLAYER_SIZE };
}

function isLoaded(image) {
  return image.complete && image.naturalWidth > 0;
}

function isGameplayState() {
  return state.appMode === "playing" || state.appMode === "game_over";
}

function setAppMode(nextMode) {
  state.appMode = nextMode;
  if (nextMode !== "playing") {
    clearTouchInput();
  }
  syncUiState();
  draw();
}

function syncUiState() {
  ui.body.classList.toggle("assets-ready", state.assetsReady);
  ui.loadingScreen.hidden = state.appMode !== "loading";
  ui.startScreen.hidden = state.appMode !== "start_menu";
  ui.modeScreen.hidden = state.appMode !== "mode_select";
  ui.sideScreen.hidden = state.appMode !== "side_select";
  ui.difficultyScreen.hidden = state.appMode !== "difficulty_select";
  ui.musicControls.hidden = !state.assetsReady || touchState.available;
  ui.hint.hidden = !isGameplayState() || touchState.available;
  ui.hint.textContent = getHintText();
  ui.modeMessage.textContent = state.appMode === "mode_select" ? state.menuMessage : "";
  ui.difficultyCopy.textContent = `You picked ${getSelectedSideLabel()}. Now choose the bot difficulty.`;
  ui.touchControls.hidden = !shouldShowTouchControls();
  ui.touchGameoverActions.hidden = !(touchState.available && state.appMode === "game_over");
  ui.touchJoystick.classList.toggle("is-disabled", state.appMode !== "playing");
  updateTouchJoystickUi();
  updateMusicUi();
}

function updateLoadingUi() {
  const ratio = state.loading.total === 0 ? 1 : state.loading.loaded / state.loading.total;
  ui.loadingCopy.textContent = `Loading visuals ${state.loading.loaded} / ${state.loading.total}`;
  ui.loadingBar.style.width = `${Math.round(ratio * 100)}%`;
}

function finishLoading() {
  if (state.assetsReady) return;
  state.assetsReady = true;
  prepareMenuPreview();
  setAppMode("start_menu");
}

function prepareMenuPreview() {
  state.gameMode = null;
  state.menuMessage = "";
  state.singlePlayerSide = "left";
  state.singlePlayerDifficulty = "medium";
  resetArenaState({ preview: true });
}

function startLocalMode() {
  state.gameMode = "local";
  state.menuMessage = "";
  resetArenaState({ preview: false });
  setAppMode("playing");
  primeAudioForSession();
}

function openModeSelect() {
  state.menuMessage = "";
  setAppMode("mode_select");
}

function openSingleSideSelect() {
  state.menuMessage = "";
  setAppMode("side_select");
}

function openSingleDifficultySelect(side) {
  state.singlePlayerSide = side;
  setAppMode("difficulty_select");
}

function startSingleMode(side, difficulty = state.singlePlayerDifficulty) {
  state.gameMode = "single";
  state.singlePlayerSide = side;
  state.singlePlayerDifficulty = difficulty;
  resetArenaState({ preview: false });
  setAppMode("playing");
  primeAudioForSession();
}

function showOnlinePlaceholder() {
  state.menuMessage = "Online mode is coming soon. Local and single-player are ready now.";
  syncUiState();
}

function returnToStartMenu() {
  prepareMenuPreview();
  setAppMode("start_menu");
}

function restartCurrentRound() {
  if (state.gameMode === "local") {
    startLocalMode();
    return;
  }
  if (state.gameMode === "single") {
    startSingleMode(state.singlePlayerSide, state.singlePlayerDifficulty);
  }
}

function resetArenaState({ preview }) {
  state.player1 = makePlayer("left");
  state.player2 = makePlayer("right");
  state.score = { p1: 0, p2: 0 };
  state.gameOverReason = "";
  state.roundWinnerSide = null;
  state.gems = [];
  state.rocks = buildRockField();
  state.aiTargetGemIndex = -1;
  state.gemSpawnTimerMs = 0;
  state.nextGemSpawnMs = chooseNextGemSpawnMs();
  keys.clear();
  clearTouchInput();

  const startingGemCount = preview ? MENU_PREVIEW_GEMS : 1;
  for (let i = 0; i < startingGemCount; i += 1) {
    spawnGem();
  }
}

function getHintText() {
  if (!isGameplayState()) {
    return "Press play to start.";
  }

  if (state.gameMode === "single") {
    const humanLabel = state.singlePlayerSide === "left" ? "You: Left / WASD" : "You: Right / Arrow Keys";
    return `${humanLabel} | ${getDifficultyConfig().label} Bot | R Restart | M Menu | F Fullscreen`;
  }

  return "Local: P1 WASD | P2 Arrow Keys | R Restart | M Menu | F Fullscreen";
}

function getSelectedSideLabel() {
  return state.singlePlayerSide === "left" ? "Left Explorer (WASD)" : "Right Explorer (Arrow Keys)";
}

function shouldUseTouchUi() {
  return window.innerWidth <= 900 || coarsePointerQuery.matches;
}

function getTouchControlSide() {
  if (state.gameMode === "single") return state.singlePlayerSide;
  return "left";
}

function shouldShowTouchControls() {
  return touchState.available && isGameplayState();
}

function updateResponsiveUi() {
  touchState.available = shouldUseTouchUi();
  if (!touchState.available) {
    clearTouchInput();
  }
  ui.body.classList.toggle("touch-ui", touchState.available);
  syncUiState();
  if (touchState.available && shouldShowTouchControls()) {
    requestAnimationFrame(() => {
      measureTouchJoystick();
      updateTouchJoystickUi();
    });
  }
}

function getControllerForSide(side) {
  if (state.gameMode === "local") return "human";
  if (state.gameMode === "single") return state.singlePlayerSide === side ? "human" : "ai";
  return "preview";
}

function getDisplayNameForSide(side) {
  if (state.gameMode === "single") {
    return state.singlePlayerSide === side ? "You" : "Bot";
  }
  return side === "left" ? "P1" : "P2";
}

function getScoreForSide(side) {
  return side === "left" ? state.score.p1 : state.score.p2;
}

function getDifficultyConfig() {
  return AI_DIFFICULTIES[state.singlePlayerDifficulty] || AI_DIFFICULTIES.medium;
}

function buildRockField() {
  return ROCK_TEMPLATES.map((rock) => {
    const insetX = Math.round(rock.w * 0.2);
    const insetTop = Math.round(rock.h * 0.22);
    const insetBottom = Math.round(rock.h * 0.2);

    return {
      ...rock,
      hitbox: {
        x: rock.x + insetX,
        y: rock.y + insetTop,
        w: rock.w - insetX * 2,
        h: rock.h - insetTop - insetBottom,
      },
    };
  });
}

function chooseNextGemSpawnMs() {
  return randInt(GEM_SPAWN_MIN_MS, GEM_SPAWN_MAX_MS);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function clampPlayer(player) {
  player.x = Math.max(0, Math.min(SCREEN_WIDTH - player.w, player.x));
  player.y = Math.max(0, Math.min(SCREEN_HEIGHT - player.h, player.y));
}

function centerOf(entity) {
  return { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 };
}

function distanceBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeVector(vector) {
  const length = Math.hypot(vector.x, vector.y);
  if (!length) return { x: 0, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

function addVectors(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function scaleVector(vector, amount) {
  return { x: vector.x * amount, y: vector.y * amount };
}

function directionBetween(from, to) {
  return normalizeVector({ x: to.x - from.x, y: to.y - from.y });
}

function closestPointInRect(point, rect) {
  return {
    x: clamp(point.x, rect.x, rect.x + rect.w),
    y: clamp(point.y, rect.y, rect.y + rect.h),
  };
}

function distanceToRect(point, rect) {
  return distanceBetween(point, closestPointInRect(point, rect));
}

function expandedRect(rect, amount) {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    w: rect.w + amount * 2,
    h: rect.h + amount * 2,
  };
}

function getNearestRockDistance(point) {
  if (!state.rocks.length) return Number.POSITIVE_INFINITY;
  return Math.min(...state.rocks.map((rock) => distanceToRect(point, rock.hitbox)));
}

function getNearestRock(point) {
  if (!state.rocks.length) return null;

  let bestRock = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const rock of state.rocks) {
    const distance = distanceToRect(point, rock.hitbox);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRock = rock;
    }
  }

  return bestRock;
}

function playerHitsRock(player, padding = 0) {
  return state.rocks.some((rock) => rectsOverlap(expandedRect(player, padding), rock.hitbox));
}

function moveRect(rect, direction, distance) {
  return {
    ...rect,
    x: rect.x + direction.x * distance,
    y: rect.y + direction.y * distance,
  };
}

function clampRectToArena(rect) {
  return {
    ...rect,
    x: clamp(rect.x, 0, SCREEN_WIDTH - rect.w),
    y: clamp(rect.y, 0, SCREEN_HEIGHT - rect.h),
  };
}

function doesProjectedPathHitRock(player, direction, speed, dt, padding = 0) {
  const normalized = normalizeVector(direction);
  if (!normalized.x && !normalized.y) return playerHitsRock(player, padding);

  const steps = 6;
  const distancePerStep = (speed * dt) / steps;
  let probe = { ...player };
  for (let index = 0; index < steps; index += 1) {
    probe = clampRectToArena(moveRect(probe, normalized, distancePerStep));
    if (playerHitsRock(probe, padding)) {
      return true;
    }
  }

  return false;
}

function getRockAvoidanceVector(point, config) {
  return state.rocks.reduce((desired, rock) => {
    const nearestPoint = closestPointInRect(point, rock.hitbox);
    const distance = distanceBetween(point, nearestPoint);
    const safeRadius = Math.max(rock.hitbox.w, rock.hitbox.h) * 0.52 + config.rockAvoidRadius;
    if (distance >= safeRadius) return desired;

    const insideFallback = directionBetween(centerOf(rock.hitbox), point);
    const away = distance > 0.01 ? directionBetween(nearestPoint, point) : insideFallback;
    const push = ((safeRadius - distance) / safeRadius) * config.rockAvoidStrength;
    return addVectors(desired, scaleVector(away, push));
  }, { x: 0, y: 0 });
}

function perpendicularLeft(vector) {
  return { x: -vector.y, y: vector.x };
}

function addUniqueDirection(candidates, vector) {
  const normalized = normalizeVector(vector);
  if (!normalized.x && !normalized.y) return;
  const key = `${normalized.x.toFixed(3)}:${normalized.y.toFixed(3)}`;
  if (candidates.some((candidate) => candidate.key === key)) return;
  candidates.push({ key, vector: normalized });
}

function scoreAiDirection(bot, direction, targetPoint, config) {
  const projected = clampRectToArena(moveRect(bot, direction, config.speed * (1 / 60)));
  const projectedCenter = centerOf(projected);
  const target = targetPoint || ARENA_CENTER;
  let score = distanceBetween(projectedCenter, target);

  const rockDistance = getNearestRockDistance(projectedCenter);
  if (rockDistance < config.rockComfortRadius) {
    score += (config.rockComfortRadius - rockDistance) * 5;
  }

  return score;
}

function chooseSafeAiDirection(bot, desired, targetPoint, config) {
  const candidates = [];
  const normalizedDesired = normalizeVector(desired);
  const botCenter = centerOf(bot);
  const nearestRock = getNearestRock(botCenter);

  addUniqueDirection(candidates, normalizedDesired);
  addUniqueDirection(candidates, directionBetween(botCenter, targetPoint || ARENA_CENTER));

  if (nearestRock) {
    const awayFromRock = directionBetween(centerOf(nearestRock.hitbox), botCenter);
    const tangentLeft = perpendicularLeft(awayFromRock);
    const tangentRight = scaleVector(tangentLeft, -1);

    addUniqueDirection(candidates, addVectors(normalizedDesired, scaleVector(awayFromRock, 1.8)));
    addUniqueDirection(candidates, addVectors(normalizedDesired, scaleVector(tangentLeft, 1.4)));
    addUniqueDirection(candidates, addVectors(normalizedDesired, scaleVector(tangentRight, 1.4)));
    addUniqueDirection(candidates, awayFromRock);
    addUniqueDirection(candidates, tangentLeft);
    addUniqueDirection(candidates, tangentRight);
  }

  const desiredLeft = perpendicularLeft(normalizedDesired);
  addUniqueDirection(candidates, addVectors(normalizedDesired, desiredLeft));
  addUniqueDirection(candidates, addVectors(normalizedDesired, scaleVector(desiredLeft, -1)));
  addUniqueDirection(candidates, desiredLeft);
  addUniqueDirection(candidates, scaleVector(desiredLeft, -1));

  let bestDirection = { x: 0, y: 0 };
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (doesProjectedPathHitRock(bot, candidate.vector, config.speed, config.rockLookaheadSec, config.rockSafetyPadding)) {
      continue;
    }

    const score = scoreAiDirection(bot, candidate.vector, targetPoint, config);
    if (score < bestScore) {
      bestScore = score;
      bestDirection = candidate.vector;
    }
  }

  return bestDirection;
}

function movePlayer(player, directionX, directionY, dt, speed) {
  const normalized = normalizeVector({ x: directionX, y: directionY });
  const magnitude = Math.min(1, Math.hypot(directionX, directionY));
  if (!magnitude) return;
  player.x += normalized.x * speed * dt * magnitude;
  player.y += normalized.y * speed * dt * magnitude;
  clampPlayer(player);
}

function getKeyboardVectorForScheme(scheme) {
  let x = 0;
  let y = 0;

  if (scheme === "wasd") {
    if (keys.has("KeyA")) x -= 1;
    if (keys.has("KeyD")) x += 1;
    if (keys.has("KeyW")) y -= 1;
    if (keys.has("KeyS")) y += 1;
  } else if (scheme === "arrows") {
    if (keys.has("ArrowLeft")) x -= 1;
    if (keys.has("ArrowRight")) x += 1;
    if (keys.has("ArrowUp")) y -= 1;
    if (keys.has("ArrowDown")) y += 1;
  }

  return { x, y };
}

function getTouchVector() {
  return { ...touchState.vector };
}

function updateTouchJoystickUi() {
  const offsetX = touchState.stickOffset.x.toFixed(2);
  const offsetY = touchState.stickOffset.y.toFixed(2);
  ui.touchJoystick.classList.toggle("is-active", touchState.active && state.appMode === "playing");
  ui.touchJoystickStick.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
}

function measureTouchJoystick() {
  const rect = ui.touchJoystick.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  touchState.center.x = rect.left + rect.width / 2;
  touchState.center.y = rect.top + rect.height / 2;
  touchState.maxStickPx = Math.max(34, rect.width * TOUCH_JOYSTICK_TRAVEL_RATIO);
}

function resetTouchJoystick() {
  if (touchState.pointerId !== null && ui.touchJoystick.hasPointerCapture?.(touchState.pointerId)) {
    ui.touchJoystick.releasePointerCapture(touchState.pointerId);
  }
  touchState.active = false;
  touchState.pointerId = null;
  touchState.vector.x = 0;
  touchState.vector.y = 0;
  touchState.stickOffset.x = 0;
  touchState.stickOffset.y = 0;
  updateTouchJoystickUi();
}

function setTouchVectorFromPoint(clientX, clientY) {
  measureTouchJoystick();
  const maxStickPx = touchState.maxStickPx;
  if (!maxStickPx) {
    resetTouchJoystick();
    return;
  }

  const rawX = clientX - touchState.center.x;
  const rawY = clientY - touchState.center.y;
  const distance = Math.hypot(rawX, rawY);
  const clampedDistance = Math.min(distance, maxStickPx);
  const direction = distance > 0.001 ? { x: rawX / distance, y: rawY / distance } : { x: 0, y: 0 };
  const magnitude = Math.min(1, distance / maxStickPx);
  const analogMagnitude =
    magnitude < TOUCH_JOYSTICK_DEAD_ZONE ? 0 : (magnitude - TOUCH_JOYSTICK_DEAD_ZONE) / (1 - TOUCH_JOYSTICK_DEAD_ZONE);

  touchState.stickOffset.x = direction.x * clampedDistance;
  touchState.stickOffset.y = direction.y * clampedDistance;
  touchState.vector.x = direction.x * analogMagnitude;
  touchState.vector.y = direction.y * analogMagnitude;
  updateTouchJoystickUi();
}

function clearTouchInput() {
  resetTouchJoystick();
}

function usesTouchControlsForSide(side) {
  if (!touchState.available) return false;
  if (state.gameMode === "single") return state.singlePlayerSide === side;
  return side === "left";
}

function getHumanInputVector(side) {
  const keyboardVector = getKeyboardVectorForScheme(side === "left" ? "wasd" : "arrows");
  if (!usesTouchControlsForSide(side)) {
    return keyboardVector;
  }

  const touchVector = getTouchVector();
  if (touchVector.x || touchVector.y) {
    return touchVector;
  }

  return keyboardVector;
}

function spawnGem() {
  const spawnBounds = {
    minX: 16,
    maxX: SCREEN_WIDTH - GEM_SIZE - 16,
    minY: LOGO_RECT.y + LOGO_RECT.h + 20,
    maxY: SCREEN_HEIGHT - GEM_SIZE - 16,
  };

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const candidate = {
      x: randInt(spawnBounds.minX, spawnBounds.maxX),
      y: randInt(spawnBounds.minY, spawnBounds.maxY),
      w: GEM_SIZE,
      h: GEM_SIZE,
    };

    const overlapsGem = state.gems.some((gem) => rectsOverlap(candidate, gem));
    if (overlapsGem) continue;
    if (rectsOverlap(candidate, state.player1) || rectsOverlap(candidate, state.player2)) continue;
    if (state.rocks.some((rock) => rectsOverlap(expandedRect(candidate, 10), expandedRect(rock.hitbox, 8)))) continue;

    state.gems.push(candidate);
    return;
  }
}

function collectGemsIfTouched() {
  if (state.gems.length === 0) return;

  const remaining = [];
  let p1CollectedCount = 0;
  let p2CollectedCount = 0;
  let collectedGemCount = 0;

  for (const gem of state.gems) {
    const p1Collected = rectsOverlap(state.player1, gem);
    const p2Collected = rectsOverlap(state.player2, gem);

    if (!p1Collected && !p2Collected) {
      remaining.push(gem);
      continue;
    }

    if (p1Collected) p1CollectedCount += 1;
    if (p2Collected) p2CollectedCount += 1;
    collectedGemCount += 1;
  }

  if (collectedGemCount === 0) return;

  state.gems = remaining;
  state.score.p1 += p1CollectedCount;
  state.score.p2 += p2CollectedCount;
  for (let i = 0; i < collectedGemCount; i += 1) {
    spawnGem();
  }
  playCollectSound();
}

function chooseAiTargetGem(bot, human, config) {
  if (state.gems.length === 0) return -1;

  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  const botCenter = centerOf(bot);
  const humanCenter = centerOf(human);
  const lead = getScoreForSide(bot.side) - getScoreForSide(human.side);

  state.gems.forEach((gem, index) => {
    const gemCenter = centerOf(gem);
    const botDistance = distanceBetween(botCenter, gemCenter);
    const humanDistance = distanceBetween(humanCenter, gemCenter);
    let score = botDistance - humanDistance * config.contestWeight;
    const rockDistance = getNearestRockDistance(gemCenter);

    if (humanDistance + 6 < botDistance) score += config.deniedPenalty;
    if (lead < 0) score -= Math.max(0, humanDistance - botDistance) * config.comebackWeight;
    if (lead > 1 && humanDistance < config.pressureRadius) score += config.leadCautionPenalty;
    if (rockDistance < config.rockComfortRadius) {
      score += (config.rockComfortRadius - rockDistance) * config.rockPenaltyWeight;
    }

    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function updateAiPlayer(bot, human, dt) {
  const config = getDifficultyConfig();
  const targetIndex = chooseAiTargetGem(bot, human, config);
  state.aiTargetGemIndex = targetIndex;

  let desired = { x: 0, y: 0 };
  const botCenter = centerOf(bot);
  const humanCenter = centerOf(human);
  const lead = getScoreForSide(bot.side) - getScoreForSide(human.side);
  const distanceToHuman = distanceBetween(botCenter, humanCenter);
  const targetPoint = targetIndex >= 0 ? centerOf(state.gems[targetIndex]) : ARENA_CENTER;

  if (targetIndex >= 0) {
    desired = addVectors(desired, directionBetween(botCenter, targetPoint));
  } else {
    desired = addVectors(desired, directionBetween(botCenter, ARENA_CENTER));
  }

  desired = addVectors(desired, getRockAvoidanceVector(botCenter, config));

  if (distanceToHuman < config.cautionRadius) {
    const avoidStrength = lead > 0 ? config.avoidWhenLeading : config.avoidWhenTrailing;
    const avoidVector = directionBetween(humanCenter, botCenter);
    desired = addVectors(
      desired,
      scaleVector(avoidVector, ((config.cautionRadius - distanceToHuman) / config.cautionRadius) * avoidStrength)
    );
  }

  if (targetIndex >= 0) {
    const humanToTarget = distanceBetween(humanCenter, targetPoint);
    const botToTarget = distanceBetween(botCenter, targetPoint);
    if (humanToTarget + 8 < botToTarget && distanceToHuman < config.cautionRadius + 22) {
      desired = addVectors(desired, scaleVector(directionBetween(humanCenter, botCenter), config.bodyBlockWeight));
    }
  }

  const safeDirection = chooseSafeAiDirection(bot, desired, targetPoint, config);
  const previousPosition = { x: bot.x, y: bot.y };
  movePlayer(bot, safeDirection.x, safeDirection.y, dt, config.speed);

  if (playerHitsRock(bot)) {
    bot.x = previousPosition.x;
    bot.y = previousPosition.y;
  }
}

function updateControllers(dt) {
  const leftController = getControllerForSide("left");
  const rightController = getControllerForSide("right");

  if (leftController === "human") {
    const input = getHumanInputVector("left");
    movePlayer(state.player1, input.x, input.y, dt, HUMAN_SPEED);
  }
  if (rightController === "human") {
    const input = getHumanInputVector("right");
    movePlayer(state.player2, input.x, input.y, dt, HUMAN_SPEED);
  }
  if (leftController === "ai") {
    updateAiPlayer(state.player1, state.player2, dt);
  }
  if (rightController === "ai") {
    updateAiPlayer(state.player2, state.player1, dt);
  }
}

function endRoundByCollision() {
  state.gameOverReason = "Collided! You collided.";
  state.roundWinnerSide = null;
  keys.clear();
  playCollisionSound();
  setAppMode("game_over");
}

function endRoundByRock(winnerSide) {
  state.gameOverReason = "Rock crash!";
  state.roundWinnerSide = winnerSide;
  keys.clear();
  playCollisionSound();
  setAppMode("game_over");
}

function updateGameplay(dt) {
  updateControllers(dt);

  if (rectsOverlap(state.player1, state.player2)) {
    endRoundByCollision();
    return;
  }

  const leftRockHit = playerHitsRock(state.player1);
  const rightRockHit = playerHitsRock(state.player2);
  if (leftRockHit || rightRockHit) {
    const winnerSide = leftRockHit && rightRockHit ? "tie" : leftRockHit ? "right" : "left";
    endRoundByRock(winnerSide);
    return;
  }

  collectGemsIfTouched();

  state.gemSpawnTimerMs += dt * 1000;
  while (state.gemSpawnTimerMs >= state.nextGemSpawnMs) {
    state.gemSpawnTimerMs -= state.nextGemSpawnMs;
    state.nextGemSpawnMs = chooseNextGemSpawnMs();
    spawnGem();
  }
}

function getAudioContext() {
  if (audioContext) return audioContext;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  audioContext = new AudioCtor();
  return audioContext;
}

function unlockAudio() {
  const audio = getAudioContext();
  if (!audio) return;
  if (audio.state === "suspended") {
    audio.resume().catch(() => {});
  }
}

function playTone({ frequency, durationSec, volume, type, slideTo, startOffsetSec = 0 }) {
  const audio = getAudioContext();
  if (!audio || audio.state !== "running") return;

  const startTime = audio.currentTime + startOffsetSec;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (typeof slideTo === "number") {
    oscillator.frequency.linearRampToValueAtTime(slideTo, startTime + durationSec);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + durationSec + 0.02);
}

function playCollectSound() {
  playTone({ frequency: 820, durationSec: 0.08, volume: 0.05, type: "triangle", slideTo: 980 });
  playTone({ frequency: 980, durationSec: 0.1, volume: 0.045, type: "triangle", startOffsetSec: 0.07, slideTo: 1180 });
}

function playCollisionSound() {
  playTone({ frequency: 220, durationSec: 0.2, volume: 0.085, type: "sawtooth", slideTo: 90 });
  playTone({ frequency: 130, durationSec: 0.23, volume: 0.08, type: "square", startOffsetSec: 0.03, slideTo: 70 });
}

function isMusicPlaying() {
  return !music.audio.paused;
}

function volumeLabel() {
  return `${Math.round(music.volume * 100)}%`;
}

function updateMusicUi() {
  if (!ui.musicStatus || !ui.musicToggle) return;

  if (!music.available) {
    ui.musicStatus.textContent = "Music unavailable";
    ui.musicDown.disabled = true;
    ui.musicUp.disabled = true;
    ui.musicToggle.disabled = true;
    ui.musicStop.disabled = true;
    return;
  }

  ui.musicStatus.textContent = `${isMusicPlaying() ? "Music On" : "Music Off"} ${volumeLabel()}`;
  ui.musicToggle.textContent = isMusicPlaying() ? "Pause" : "Play";
}

function startMusicPlayback() {
  if (!music.available) return;
  music.audio.volume = music.volume;
  const playPromise = music.audio.play();
  if (playPromise && typeof playPromise.then === "function") {
    playPromise.then(updateMusicUi).catch(updateMusicUi);
  } else {
    updateMusicUi();
  }
}

function pauseMusicPlayback() {
  music.userPaused = true;
  music.audio.pause();
  updateMusicUi();
}

function stopMusicPlayback() {
  music.stoppedByUser = true;
  music.userPaused = false;
  music.audio.pause();
  music.audio.currentTime = 0;
  updateMusicUi();
}

function toggleMusicPlayback() {
  unlockAudio();
  if (isMusicPlaying()) {
    pauseMusicPlayback();
    return;
  }
  music.stoppedByUser = false;
  music.userPaused = false;
  startMusicPlayback();
}

function changeMusicVolume(delta) {
  const nextVolume = Math.max(0, Math.min(1, music.volume + delta));
  music.volume = Math.round(nextVolume * 100) / 100;
  music.audio.volume = music.volume;
  updateMusicUi();
}

function primeAudioForSession() {
  unlockAudio();
  if (!music.available || music.stoppedByUser || music.userPaused || isMusicPlaying()) return;
  startMusicPlayback();
}

function setupMusicControls() {
  music.audio.loop = true;
  music.audio.preload = "auto";
  music.audio.volume = music.volume;
  music.audio.addEventListener("error", () => {
    music.available = false;
    updateMusicUi();
  });
  music.audio.addEventListener("play", updateMusicUi);
  music.audio.addEventListener("pause", updateMusicUi);

  ui.musicDown.addEventListener("click", () => {
    changeMusicVolume(-0.1);
  });
  ui.musicUp.addEventListener("click", () => {
    changeMusicVolume(0.1);
  });
  ui.musicToggle.addEventListener("click", () => {
    toggleMusicPlayback();
  });
  ui.musicStop.addEventListener("click", () => {
    stopMusicPlayback();
  });

  updateMusicUi();
}

function setupMenuUi() {
  ui.startPlay.addEventListener("click", () => {
    openModeSelect();
  });
  ui.modeLocal.addEventListener("click", () => {
    startLocalMode();
  });
  ui.modeSingle.addEventListener("click", () => {
    openSingleSideSelect();
  });
  ui.modeOnline.addEventListener("click", () => {
    showOnlinePlaceholder();
  });
  ui.modeBack.addEventListener("click", () => {
    setAppMode("start_menu");
  });
  ui.sideLeft.addEventListener("click", () => {
    openSingleDifficultySelect("left");
  });
  ui.sideRight.addEventListener("click", () => {
    openSingleDifficultySelect("right");
  });
  ui.sideBack.addEventListener("click", () => {
    openModeSelect();
  });
  ui.difficultyEasy.addEventListener("click", () => {
    startSingleMode(state.singlePlayerSide, "easy");
  });
  ui.difficultyMedium.addEventListener("click", () => {
    startSingleMode(state.singlePlayerSide, "medium");
  });
  ui.difficultyHard.addEventListener("click", () => {
    startSingleMode(state.singlePlayerSide, "hard");
  });
  ui.difficultyBack.addEventListener("click", () => {
    openSingleSideSelect();
  });
}

function setupTouchControls() {
  const startJoystick = (event) => {
    if (!touchState.available || state.appMode !== "playing") return;
    if (touchState.pointerId !== null && touchState.pointerId !== event.pointerId) return;
    event.preventDefault();
    primeAudioForSession();
    measureTouchJoystick();
    touchState.active = true;
    touchState.pointerId = event.pointerId;
    ui.touchJoystick.setPointerCapture?.(event.pointerId);
    setTouchVectorFromPoint(event.clientX, event.clientY);
  };

  const moveJoystick = (event) => {
    if (!touchState.active || touchState.pointerId !== event.pointerId) return;
    event.preventDefault();
    setTouchVectorFromPoint(event.clientX, event.clientY);
  };

  const stopJoystick = (event) => {
    if (touchState.pointerId !== event.pointerId) return;
    event.preventDefault();
    resetTouchJoystick();
  };

  ui.touchJoystick.addEventListener("pointerdown", startJoystick);
  ui.touchJoystick.addEventListener("pointermove", moveJoystick);
  ui.touchJoystick.addEventListener("pointerup", stopJoystick);
  ui.touchJoystick.addEventListener("pointercancel", stopJoystick);
  ui.touchJoystick.addEventListener("lostpointercapture", () => {
    if (touchState.active) {
      resetTouchJoystick();
    }
  });
  ui.touchJoystick.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  ui.touchRestart.addEventListener("click", () => {
    if (isGameplayState()) {
      restartCurrentRound();
    }
  });

  ui.touchMenu.addEventListener("click", () => {
    if (isGameplayState()) {
      returnToStartMenu();
    }
  });
}

function drawSprite(image, x, y, w, h, fallbackColor) {
  if (isLoaded(image)) {
    ctx.drawImage(image, x, y, w, h);
    return;
  }
  ctx.fillStyle = fallbackColor;
  ctx.fillRect(x, y, w, h);
}

function drawBackground() {
  if (isLoaded(assets.map)) {
    ctx.drawImage(assets.map, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  gradient.addColorStop(0, "#0f172a");
  gradient.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
}

function drawRocks() {
  for (const rock of state.rocks) {
    const sprite = rockSprites[rock.variant % rockSprites.length];
    const wasSmoothing = ctx.imageSmoothingEnabled;

    ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
    ctx.beginPath();
    ctx.ellipse(rock.x + rock.w / 2, rock.y + rock.h - 8, rock.w * 0.38, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, rock.x, rock.y, rock.w, rock.h);
    ctx.imageSmoothingEnabled = wasSmoothing;
  }
}

function drawHudPanel(x, y, text, align) {
  const width = 188;
  const height = 48;
  ctx.fillStyle = "rgba(15, 23, 42, 0.78)";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "rgba(191, 219, 254, 0.6)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);

  ctx.fillStyle = "#e0f2fe";
  ctx.font = "bold 26px Trebuchet MS, Segoe UI, sans-serif";
  ctx.textBaseline = "middle";
  ctx.textAlign = align;

  if (align === "left") {
    ctx.fillText(text, x + 14, y + height / 2);
  } else {
    ctx.fillText(text, x + width - 14, y + height / 2);
  }
}

function drawHud() {
  drawHudPanel(16, 16, `${getDisplayNameForSide("left")}: ${state.score.p1}`, "left");
  drawHudPanel(SCREEN_WIDTH - 204, 16, `${getDisplayNameForSide("right")}: ${state.score.p2}`, "right");
}

function winnerText() {
  if (state.roundWinnerSide === "tie") {
    return "Tie game";
  }
  if (state.roundWinnerSide === "left" || state.roundWinnerSide === "right") {
    const winnerName = getDisplayNameForSide(state.roundWinnerSide);
    return winnerName === "You" ? "You win" : `${winnerName} wins`;
  }
  if (state.score.p1 > state.score.p2) {
    return getDisplayNameForSide("left") === "You" ? "You win" : `${getDisplayNameForSide("left")} wins`;
  }
  if (state.score.p2 > state.score.p1) {
    return getDisplayNameForSide("right") === "You" ? "You win" : `${getDisplayNameForSide("right")} wins`;
  }
  return "Tie game";
}

function drawGameOverOverlay() {
  ctx.fillStyle = "rgba(2, 6, 23, 0.62)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "bold 72px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText(state.gameOverReason, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 52);

  ctx.font = "bold 40px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText(
    `${winnerText()}  |  ${getDisplayNameForSide("left")} ${state.score.p1} - ${state.score.p2} ${getDisplayNameForSide("right")}`,
    SCREEN_WIDTH / 2,
    SCREEN_HEIGHT / 2 + 22
  );

  ctx.font = "28px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText("Press R to restart or M for menu", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 88);
}

function draw() {
  if (!state.assetsReady) return;

  drawBackground();
  drawRocks();

  for (const gem of state.gems) {
    drawSprite(assets.gem, gem.x, gem.y, gem.w, gem.h, "#10b981");
  }

  drawSprite(assets.player1, state.player1.x, state.player1.y, state.player1.w, state.player1.h, "#3b82f6");
  drawSprite(assets.player2, state.player2.x, state.player2.y, state.player2.w, state.player2.h, "#e11d48");
  drawSprite(assets.logo, LOGO_RECT.x, LOGO_RECT.y, LOGO_RECT.w, LOGO_RECT.h, "rgba(251, 191, 36, 0.35)");
  drawHud();

  if (state.appMode === "game_over") {
    drawGameOverOverlay();
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

window.addEventListener("keydown", (event) => {
  if (state.appMode === "loading") return;

  if (event.code === "KeyF") {
    event.preventDefault();
    toggleFullscreen();
  }

  if (event.code === "KeyM" && isGameplayState()) {
    event.preventDefault();
    returnToStartMenu();
    return;
  }

  if (event.code === "KeyR" && isGameplayState()) {
    event.preventDefault();
    restartCurrentRound();
    return;
  }

  if (state.appMode !== "playing") return;

  keys.add(event.code);
  primeAudioForSession();

  if (event.code.startsWith("Arrow") || event.code === "Space") {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
  clearTouchInput();
});

window.addEventListener("resize", () => {
  updateResponsiveUi();
});

if (typeof coarsePointerQuery.addEventListener === "function") {
  coarsePointerQuery.addEventListener("change", updateResponsiveUi);
} else if (typeof coarsePointerQuery.addListener === "function") {
  coarsePointerQuery.addListener(updateResponsiveUi);
}

window.render_game_to_text = () =>
  JSON.stringify({
    mode: state.appMode,
    gameMode: state.gameMode,
    singlePlayerSide: state.singlePlayerSide,
    singlePlayerDifficulty: state.singlePlayerDifficulty,
    coords: "origin at top-left; +x right, +y down",
    loading: {
      ready: state.assetsReady,
      loaded: state.loading.loaded,
      total: state.loading.total,
    },
    controllers: {
      left: getControllerForSide("left"),
      right: getControllerForSide("right"),
    },
    player1: state.player1,
    player2: state.player2,
    gems: state.gems,
    gemCount: state.gems.length,
    rocks: state.rocks,
    rockCount: state.rocks.length,
    score: state.score,
    gameOverReason: state.gameOverReason,
    roundWinnerSide: state.roundWinnerSide,
    nextGemInMs: Math.max(0, Math.round(state.nextGemSpawnMs - state.gemSpawnTimerMs)),
    ai: {
      active: state.gameMode === "single",
      targetGemIndex: state.aiTargetGemIndex,
      difficulty: getDifficultyConfig().label,
      speed: getDifficultyConfig().speed,
    },
    touch: {
      available: touchState.available,
      visible: shouldShowTouchControls(),
      side: getTouchControlSide(),
      active: touchState.active,
      vector: {
        x: Number(touchState.vector.x.toFixed(3)),
        y: Number(touchState.vector.y.toFixed(3)),
      },
      gameOverActionsVisible: touchState.available && state.appMode === "game_over",
    },
    menuMessage: state.menuMessage,
    hint: getHintText(),
    music: {
      available: music.available,
      playing: isMusicPlaying(),
      stoppedByUser: music.stoppedByUser,
      userPaused: music.userPaused,
      volume: music.volume,
    },
  });

window.advanceTime = async (ms) => {
  const step = 1000 / 60;
  let remaining = Math.max(0, ms);
  while (remaining > 0) {
    const dtMs = Math.min(step, remaining);
    if (state.appMode === "playing") {
      updateGameplay(dtMs / 1000);
    }
    remaining -= dtMs;
  }
  draw();
};

window.__debug_set_gem = (x, y) => {
  state.gems = [
    {
      x: Math.max(0, Math.min(SCREEN_WIDTH - GEM_SIZE, Number(x) || 0)),
      y: Math.max(0, Math.min(SCREEN_HEIGHT - GEM_SIZE, Number(y) || 0)),
      w: GEM_SIZE,
      h: GEM_SIZE,
    },
  ];
  draw();
};

window.__debug_add_gem = (x, y) => {
  state.gems.push({
    x: Math.max(0, Math.min(SCREEN_WIDTH - GEM_SIZE, Number(x) || 0)),
    y: Math.max(0, Math.min(SCREEN_HEIGHT - GEM_SIZE, Number(y) || 0)),
    w: GEM_SIZE,
    h: GEM_SIZE,
  });
  draw();
};

window.__debug_clear_gems = () => {
  state.gems = [];
  draw();
};

window.__debug_set_players = (p1, p2) => {
  if (p1 && Number.isFinite(p1.x) && Number.isFinite(p1.y)) {
    state.player1.x = p1.x;
    state.player1.y = p1.y;
  }
  if (p2 && Number.isFinite(p2.x) && Number.isFinite(p2.y)) {
    state.player2.x = p2.x;
    state.player2.y = p2.y;
  }
  clampPlayer(state.player1);
  clampPlayer(state.player2);
  draw();
};

window.__debug_reset_game = () => {
  if (!state.gameMode) {
    state.gameMode = "local";
  }
  restartCurrentRound();
};

window.__debug_start_mode = (mode, side = "left", difficulty = "medium") => {
  if (mode === "single") {
    startSingleMode(side === "right" ? "right" : "left", difficulty);
    return;
  }
  startLocalMode();
};

let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;

  if (state.appMode === "playing") {
    updateGameplay(dt);
  }

  draw();
  requestAnimationFrame(frame);
}

setupMenuUi();
setupMusicControls();
setupTouchControls();
updateLoadingUi();
updateResponsiveUi();
syncUiState();
requestAnimationFrame(frame);
