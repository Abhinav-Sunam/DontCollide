const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const SCREEN_WIDTH = 1512;
const SCREEN_HEIGHT = 982;
const PLAYER_SIZE = 75;
const GEM_SIZE = 25;
const SPEED = 300; // pixels/second (roughly 5px/frame @ 60fps)
const GEM_SPAWN_MIN_MS = 3000;
const GEM_SPAWN_MAX_MS = 5000;
const LOGO_RECT = { x: (SCREEN_WIDTH - 750) / 2, y: 10, w: 750, h: 188 };

const state = {
  mode: "playing",
  player1: { x: 200, y: 250, w: PLAYER_SIZE, h: PLAYER_SIZE },
  player2: { x: 400, y: 250, w: PLAYER_SIZE, h: PLAYER_SIZE },
  gems: [],
  score: { p1: 0, p2: 0 },
  gameOverReason: "",
  gemSpawnTimerMs: 0,
  nextGemSpawnMs: 0,
};

const keys = new Set();
let audioContext = null;
const music = {
  audio: new Audio("song.mp3"),
  volume: 0.1,
  stoppedByUser: false,
  available: true,
};

const musicUi = {
  status: document.getElementById("music-status"),
  down: document.getElementById("music-down"),
  up: document.getElementById("music-up"),
  toggle: document.getElementById("music-toggle"),
  stop: document.getElementById("music-stop"),
};

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

const assets = {
  map: loadImage("map1.png"),
  player1: loadImage("player1.png"),
  player2: loadImage("player2.png"),
  gem: loadImage("gem.png"),
  logo: loadImage("logo.png"),
};

function isLoaded(image) {
  return image.complete && image.naturalWidth > 0;
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

  const start = audio.currentTime + startOffsetSec;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, start);
  if (typeof slideTo === "number") {
    osc.frequency.linearRampToValueAtTime(slideTo, start + durationSec);
  }

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(start + durationSec + 0.02);
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
  if (!musicUi.status || !musicUi.toggle) return;

  if (!music.available) {
    musicUi.status.textContent = "Music unavailable";
    musicUi.toggle.disabled = true;
    if (musicUi.down) musicUi.down.disabled = true;
    if (musicUi.up) musicUi.up.disabled = true;
    if (musicUi.stop) musicUi.stop.disabled = true;
    return;
  }

  musicUi.status.textContent = `${isMusicPlaying() ? "Music On" : "Music Off"} ${volumeLabel()}`;
  musicUi.toggle.textContent = isMusicPlaying() ? "Pause" : "Play";
}

function startMusicPlayback() {
  if (!music.available) return;
  music.audio.volume = music.volume;
  const playPromise = music.audio.play();
  if (playPromise && typeof playPromise.then === "function") {
    playPromise.then(updateMusicUi).catch(() => {
      updateMusicUi();
    });
  } else {
    updateMusicUi();
  }
}

function pauseMusicPlayback() {
  music.audio.pause();
  updateMusicUi();
}

function stopMusicPlayback() {
  music.stoppedByUser = true;
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
  startMusicPlayback();
}

function changeMusicVolume(delta) {
  const next = Math.max(0, Math.min(1, music.volume + delta));
  music.volume = Math.round(next * 100) / 100;
  music.audio.volume = music.volume;
  updateMusicUi();
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

  if (musicUi.down) {
    musicUi.down.addEventListener("click", () => {
      changeMusicVolume(-0.1);
    });
  }
  if (musicUi.up) {
    musicUi.up.addEventListener("click", () => {
      changeMusicVolume(0.1);
    });
  }
  if (musicUi.toggle) {
    musicUi.toggle.addEventListener("click", () => {
      toggleMusicPlayback();
    });
  }
  if (musicUi.stop) {
    musicUi.stop.addEventListener("click", () => {
      stopMusicPlayback();
    });
  }

  updateMusicUi();
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

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chooseNextGemSpawnMs() {
  return randInt(GEM_SPAWN_MIN_MS, GEM_SPAWN_MAX_MS);
}

function spawnGem() {
  const spawnBounds = {
    minX: 16,
    maxX: SCREEN_WIDTH - GEM_SIZE - 16,
    minY: LOGO_RECT.y + LOGO_RECT.h + 20,
    maxY: SCREEN_HEIGHT - GEM_SIZE - 16,
  };

  for (let attempt = 0; attempt < 300; attempt++) {
    const x = randInt(spawnBounds.minX, spawnBounds.maxX);
    const y = randInt(spawnBounds.minY, spawnBounds.maxY);
    const candidate = { x, y, w: GEM_SIZE, h: GEM_SIZE };
    const overlapsExistingGem = state.gems.some((gem) => rectsOverlap(candidate, gem));
    if (
      !overlapsExistingGem &&
      !rectsOverlap(candidate, state.player1) &&
      !rectsOverlap(candidate, state.player2)
    ) {
      state.gems.push(candidate);
      break;
    }
  }
}

function endRoundByCollision() {
  state.mode = "game_over";
  state.gameOverReason = "Collided! You collided.";
  keys.clear();
  playCollisionSound();
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
  for (let i = 0; i < collectedGemCount; i++) {
    spawnGem();
  }
  playCollectSound();
}

function resetGame() {
  state.mode = "playing";
  state.player1.x = 200;
  state.player1.y = 250;
  state.player2.x = 400;
  state.player2.y = 250;
  state.score.p1 = 0;
  state.score.p2 = 0;
  state.gameOverReason = "";
  state.gems = [];
  state.gemSpawnTimerMs = 0;
  state.nextGemSpawnMs = chooseNextGemSpawnMs();
  keys.clear();
  spawnGem();
}

function update(dt) {
  if (state.mode !== "playing") return;

  if (keys.has("KeyA")) state.player1.x -= SPEED * dt;
  if (keys.has("KeyD")) state.player1.x += SPEED * dt;
  if (keys.has("KeyW")) state.player1.y -= SPEED * dt;
  if (keys.has("KeyS")) state.player1.y += SPEED * dt;

  if (keys.has("ArrowLeft")) state.player2.x -= SPEED * dt;
  if (keys.has("ArrowRight")) state.player2.x += SPEED * dt;
  if (keys.has("ArrowUp")) state.player2.y -= SPEED * dt;
  if (keys.has("ArrowDown")) state.player2.y += SPEED * dt;

  clampPlayer(state.player1);
  clampPlayer(state.player2);

  if (rectsOverlap(state.player1, state.player2)) {
    endRoundByCollision();
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

function draw() {
  drawBackground();

  drawSprite(assets.player1, state.player1.x, state.player1.y, state.player1.w, state.player1.h, "#3b82f6");
  drawSprite(assets.player2, state.player2.x, state.player2.y, state.player2.w, state.player2.h, "#e11d48");
  for (const gem of state.gems) {
    drawSprite(assets.gem, gem.x, gem.y, gem.w, gem.h, "#10b981");
  }

  drawSprite(assets.logo, LOGO_RECT.x, LOGO_RECT.y, LOGO_RECT.w, LOGO_RECT.h, "rgba(251, 191, 36, 0.35)");

  drawHud();

  if (state.mode === "game_over") {
    drawGameOverOverlay();
  }
}

function drawHudPanel(x, y, text, align) {
  const width = 170;
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
  drawHudPanel(16, 16, `P1: ${state.score.p1}`, "left");
  drawHudPanel(SCREEN_WIDTH - 186, 16, `P2: ${state.score.p2}`, "right");
}

function winnerText() {
  if (state.score.p1 > state.score.p2) return "Player 1 wins";
  if (state.score.p2 > state.score.p1) return "Player 2 wins";
  return "Tie game";
}

function drawGameOverOverlay() {
  ctx.fillStyle = "rgba(2, 6, 23, 0.62)";
  ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

  ctx.fillStyle = "#f8fafc";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "bold 72px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText(state.gameOverReason, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 50);

  ctx.font = "bold 40px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText(`${winnerText()}  |  P1 ${state.score.p1} - ${state.score.p2} P2`, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 24);

  ctx.font = "28px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText("Press R to restart", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 88);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    canvas.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

window.addEventListener("keydown", (event) => {
  unlockAudio();

  if (event.code === "KeyF") {
    event.preventDefault();
    toggleFullscreen();
  }

  if (event.code === "KeyR" && state.mode === "game_over") {
    event.preventDefault();
    resetGame();
  }

  keys.add(event.code);

  if (!music.stoppedByUser && !isMusicPlaying()) {
    startMusicPlayback();
  }

  if (event.code.startsWith("Arrow") || event.code === "Space") {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
});

window.addEventListener("blur", () => {
  keys.clear();
});

window.render_game_to_text = () =>
  JSON.stringify({
    mode: state.mode,
    coords: "origin at top-left; +x right, +y down",
    player1: state.player1,
    player2: state.player2,
    gem: state.gems[0] || null,
    gems: state.gems,
    gemCount: state.gems.length,
    score: state.score,
    gameOverReason: state.gameOverReason,
    nextGemInMs: Math.max(0, Math.round(state.nextGemSpawnMs - state.gemSpawnTimerMs)),
    music: {
      available: music.available,
      playing: isMusicPlaying(),
      stoppedByUser: music.stoppedByUser,
      volume: music.volume,
    },
  });

window.advanceTime = async (ms) => {
  const step = 1000 / 60;
  let remaining = Math.max(0, ms);
  while (remaining > 0) {
    const dtMs = Math.min(step, remaining);
    update(dtMs / 1000);
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
};

window.__debug_add_gem = (x, y) => {
  state.gems.push({
    x: Math.max(0, Math.min(SCREEN_WIDTH - GEM_SIZE, Number(x) || 0)),
    y: Math.max(0, Math.min(SCREEN_HEIGHT - GEM_SIZE, Number(y) || 0)),
    w: GEM_SIZE,
    h: GEM_SIZE,
  });
};

window.__debug_clear_gems = () => {
  state.gems = [];
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
};

window.__debug_reset_game = () => {
  resetGame();
  draw();
};

let previous = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - previous) / 1000);
  previous = now;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

resetGame();
setupMusicControls();
requestAnimationFrame(frame);
