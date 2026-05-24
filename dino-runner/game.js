const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const statusEl = document.querySelector("#status");
const restartButton = document.querySelector("#restart");
const soundButton = document.querySelector("#sound");
const dinoButtons = [...document.querySelectorAll(".dino-option")];
const fartAudio = new Audio("assets/farting-sound-effects.webm");
fartAudio.preload = "auto";

const gridSize = 48;
const tileCount = canvas.width / gridSize;
const tickMs = 115;
const dinoTypes = {
  trex: { label: "T-Rex", diet: "meat", color: "#ef4444", accent: "#f97316" },
  triceratops: { label: "Trike", diet: "leaf", color: "#38bdf8", accent: "#0ea5e9" },
  stegosaurus: { label: "Stego", diet: "leaf", color: "#fbbf24", accent: "#f97316" },
  bronto: { label: "Bronto", diet: "leaf", color: "#a78bfa", accent: "#7c3aed" },
};
const foodCount = 12;
const bugColors = ["#0f172a", "#7f1d1d", "#78350f", "#365314"];

let dino;
let selectedDino = "trex";
let foods;
let bugs;
let poops;
let sticks;
let snakeBursts;
let direction;
let nextDirection;
let score;
let running;
let timerId;
let effectAnimationId;
let lastEffectFrameAt;
let pointerPosition;
let touchPointerId;
let audioContext;
let audioReady;

function ensureAudio() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  unlockAudio();
  if (fartAudio.readyState === 0) {
    fartAudio.load();
  }
  audioReady = true;
  soundButton.textContent = "Sound On";
}

function unlockAudio() {
  if (!audioContext || audioReady) return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.01);
}

function playTone(frequency, duration = 0.12, type = "sine", volume = 0.16, delay = 0) {
  if (!audioContext) return;

  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playNoise(duration = 0.16, volume = 0.1) {
  if (!audioContext) return;

  const sampleCount = Math.floor(audioContext.sampleRate * duration);
  const buffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < sampleCount; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
  source.connect(gain).connect(audioContext.destination);
  source.start();
}

function playSound(name) {
  if (!audioContext) return;

  if (name === "fart") {
    const fartClip = fartAudio.cloneNode();
    fartClip.currentTime = 0.35 + Math.random() * 2.5;
    fartClip.volume = 0.9;
    window.setTimeout(() => {
      fartClip.pause();
      fartClip.currentTime = 0;
    }, 650);
    fartClip.play().catch(() => {
      playTone(105, 0.22, "sawtooth", 0.18);
      playTone(72, 0.32, "square", 0.12, 0.08);
      playNoise(0.24, 0.08);
    });
  } else if (name === "bleergh") {
    playTone(240, 0.1, "sawtooth", 0.14);
    playTone(155, 0.2, "sawtooth", 0.16, 0.06);
    playTone(92, 0.28, "triangle", 0.12, 0.16);
    playNoise(0.22, 0.07);
  } else if (name === "sticks") {
    playTone(520, 0.05, "square", 0.1);
    playTone(760, 0.05, "square", 0.09, 0.04);
    playNoise(0.1, 0.055);
  } else if (name === "select") {
    playTone(300, 0.06, "sine", 0.1);
    playTone(450, 0.08, "sine", 0.09, 0.05);
  }
}

function resetGame() {
  dino = { x: 7, y: 7 };
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  foods = [];
  bugs = [];
  poops = [];
  sticks = [];
  snakeBursts = [];
  score = 0;
  running = false;
  stopEffectLoop();
  pointerPosition = null;
  touchPointerId = null;
  scoreEl.textContent = score;
  statusEl.textContent = `${dinoTypes[selectedDino].label} likes ${foodLabel(dinoTypes[selectedDino].diet)}.`;
  placeFoods();
  stopLoop();
  draw();
}

function startLoop() {
  if (running) return;
  running = true;
  timerId = window.setInterval(tick, tickMs);
}

function stopLoop() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
  running = false;
  startEffectLoop();
}

function tick() {
  steerTowardPointerPosition();
  direction = nextDirection;
  dino = {
    x: wrap(dino.x + direction.x),
    y: wrap(dino.y + direction.y),
  };

  const eatenFoodIndex = foods.findIndex((food) => food.x === dino.x && food.y === dino.y);
  const eatenPoopIndex = poops.findIndex((poop) => poop.x === dino.x && poop.y === dino.y);

  if (eatenFoodIndex !== -1) {
    eatFood(eatenFoodIndex);
  } else if (eatenPoopIndex !== -1) {
    eatPoop(eatenPoopIndex);
  }

  updateBugs();
  updateSticks();
  draw();
}

function eatFood(index) {
  const food = foods[index];
  const diet = dinoTypes[selectedDino].diet;
  foods.splice(index, 1);
  spawnMouthSnakes();

  if (food.kind === diet) {
    score += 1;
    scoreEl.textContent = score;
    statusEl.textContent = "Yum!";
    playSound("fart");
    placePoop();
  } else {
    score = Math.max(0, score - 1);
    scoreEl.textContent = score;
    statusEl.textContent = "Bleh!";
    playSound("bleergh");
    spawnBugs();
  }

  placeFood();
}

function eatPoop(index) {
  poops.splice(index, 1);
  statusEl.textContent = "Ptooey! Sticks!";
  spawnMouthSnakes();
  playSound("sticks");
  spawnSticks();
}

function placeFoods() {
  foods = [];
  while (foods.length < foodCount) {
    placeFood();
  }
}

function placeFood() {
  const openCells = [];

  for (let y = 0; y < tileCount; y += 1) {
    for (let x = 0; x < tileCount; x += 1) {
      const occupiedByDino = dino.x === x && dino.y === y;
      const occupiedByFood = foods.some((food) => food.x === x && food.y === y);
      const occupiedByPoop = poops.some((poop) => poop.x === x && poop.y === y);
      if (!occupiedByDino && !occupiedByFood && !occupiedByPoop) {
        openCells.push({ x, y });
      }
    }
  }

  if (openCells.length === 0) return;

  const food = openCells[Math.floor(Math.random() * openCells.length)];
  food.kind = Math.random() < 0.5 ? "leaf" : "meat";
  foods.push(food);
}

function placePoop() {
  const behind = {
    x: wrap(dino.x - direction.x),
    y: wrap(dino.y - direction.y),
  };

  if (
    foods.some((food) => food.x === behind.x && food.y === behind.y) ||
    poops.some((poop) => poop.x === behind.x && poop.y === behind.y)
  ) {
    return;
  }

  poops.push({
    ...behind,
    wiggle: Math.random() * Math.PI * 2,
  });

  if (poops.length > 18) {
    poops.shift();
  }
}

function spawnBugs() {
  const mouth = mouthPosition();

  for (let i = 0; i < 18; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.5 + Math.random() * 3.6;
    bugs.push({
      x: mouth.x,
      y: mouth.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 38 + Math.random() * 22,
      color: bugColors[i % bugColors.length],
      wing: Math.random() * Math.PI * 2,
    });
  }
  startEffectLoop();
}

function updateBugs() {
  bugs = bugs
    .map((bug) => ({
      ...bug,
      x: bug.x + bug.vx,
      y: bug.y + bug.vy,
      vx: bug.vx * 0.985,
      vy: bug.vy * 0.985,
      life: bug.life - 1,
      wing: bug.wing + 0.7,
    }))
    .filter((bug) => bug.life > 0);
}

function spawnMouthSnakes() {
  const mouth = mouthPosition();

  for (let i = 0; i < 7; i += 1) {
    const angle = Math.atan2(direction.y, direction.x) + (Math.random() - 0.5) * 1.2;
    const speed = 2 + Math.random() * 3.2;
    snakeBursts.push({
      x: mouth.x,
      y: mouth.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 34 + Math.random() * 18,
      wiggle: Math.random() * Math.PI * 2,
      color: ["#22c55e", "#a3e635", "#14b8a6", "#84cc16"][i % 4],
    });
  }

  startEffectLoop();
}

function spawnSticks() {
  const mouth = mouthPosition();

  for (let i = 0; i < 16; i += 1) {
    const angle = -Math.atan2(direction.y, direction.x) + (Math.random() - 0.5) * 1.8;
    const forwardAngle = Math.atan2(direction.y, direction.x) + (Math.random() - 0.5) * 1.4;
    const speed = 2 + Math.random() * 4.4;
    sticks.push({
      x: mouth.x,
      y: mouth.y,
      vx: Math.cos(forwardAngle) * speed,
      vy: Math.sin(forwardAngle) * speed,
      angle,
      spin: (Math.random() - 0.5) * 0.45,
      length: 13 + Math.random() * 14,
      life: 34 + Math.random() * 22,
    });
  }
  startEffectLoop();
}

function updateSticks() {
  sticks = sticks
    .map((stick) => ({
      ...stick,
      x: stick.x + stick.vx,
      y: stick.y + stick.vy,
      vx: stick.vx * 0.976,
      vy: stick.vy * 0.976,
      angle: stick.angle + stick.spin,
      life: stick.life - 1,
    }))
    .filter((stick) => stick.life > 0);
}

function updateSnakeBursts() {
  snakeBursts = snakeBursts
    .map((snake) => ({
      ...snake,
      x: snake.x + snake.vx,
      y: snake.y + snake.vy,
      vx: snake.vx * 0.982,
      vy: snake.vy * 0.982,
      wiggle: snake.wiggle + 0.65,
      life: snake.life - 1,
    }))
    .filter((snake) => snake.life > 0);
}

function startEffectLoop() {
  if (effectAnimationId || bugs.length + sticks.length + snakeBursts.length === 0) return;

  lastEffectFrameAt = performance.now();

  function animateEffects(now) {
    if (!running && now - lastEffectFrameAt >= tickMs) {
      lastEffectFrameAt = now;
      updateBugs();
      updateSticks();
      updateSnakeBursts();
      draw();
    }

    if (bugs.length + sticks.length + snakeBursts.length > 0) {
      effectAnimationId = requestAnimationFrame(animateEffects);
    } else {
      effectAnimationId = null;
    }
  }

  effectAnimationId = requestAnimationFrame(animateEffects);
}

function stopEffectLoop() {
  if (effectAnimationId) {
    cancelAnimationFrame(effectAnimationId);
    effectAnimationId = null;
  }
}

function setDirection(newDirection) {
  nextDirection = newDirection;
  startLoop();
}

function steerTowardPointer(event) {
  event.preventDefault();
  ensureAudio();

  if (event.pointerType === "touch" && touchPointerId !== event.pointerId) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  pointerPosition = {
    x: (event.clientX - rect.left) * scale,
    y: (event.clientY - rect.top) * scale,
  };
  steerTowardPointerPosition();
  startLoop();
}

function startTouchControl(event) {
  ensureAudio();

  if (event.pointerType !== "touch") {
    steerTowardPointer(event);
    return;
  }

  event.preventDefault();
  touchPointerId = event.pointerId;
  canvas.setPointerCapture(event.pointerId);
  steerTowardPointer(event);
}

function stopTouchControl(event) {
  if (event.pointerType !== "touch" || touchPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  touchPointerId = null;
  pointerPosition = null;
  stopLoop();
  statusEl.textContent = `${dinoTypes[selectedDino].label} is waiting.`;
}

function steerTowardPointerPosition() {
  if (!pointerPosition) return;

  const dinoCenter = {
    x: dino.x * gridSize + gridSize / 2,
    y: dino.y * gridSize + gridSize / 2,
  };
  const deltaX = pointerPosition.x - dinoCenter.x;
  const deltaY = pointerPosition.y - dinoCenter.y;

  if (Math.abs(deltaX) < gridSize / 2 && Math.abs(deltaY) < gridSize / 2) {
    return;
  }

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    setDirection({ x: Math.sign(deltaX), y: 0 });
  } else {
    setDirection({ x: 0, y: Math.sign(deltaY) });
  }
}

function wrap(value) {
  if (value < 0) return tileCount - 1;
  if (value >= tileCount) return 0;
  return value;
}

function foodLabel(kind) {
  return kind === "meat" ? "meat" : "leaves";
}

function mouthPosition() {
  const centerX = dino.x * gridSize + gridSize / 2;
  const centerY = dino.y * gridSize + gridSize / 2;
  return {
    x: centerX + direction.x * gridSize * 0.28,
    y: centerY + direction.y * gridSize * 0.28,
  };
}

function draw() {
  drawBackground();
  drawPoops();
  drawFoods();
  drawDino();
  drawBugs();
  drawSticks();
  drawSnakeBursts();
}

function drawBackground() {
  ctx.fillStyle = "#2f5b36";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < tileCount; row += 1) {
    for (let col = 0; col < tileCount; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#315f39" : "#2a5332";
      ctx.fillRect(col * gridSize, row * gridSize, gridSize, gridSize);
    }
  }

  drawRiver();
  drawFerns();
  drawRocks();
}

function drawRiver() {
  ctx.strokeStyle = "rgba(94, 234, 212, 0.22)";
  ctx.lineWidth = 34;
  ctx.beginPath();
  ctx.moveTo(-20, canvas.height * 0.78);
  ctx.bezierCurveTo(160, 570, 260, 720, 430, 590);
  ctx.bezierCurveTo(550, 500, 610, 560, 750, 470);
  ctx.stroke();
}

function drawFerns() {
  ctx.strokeStyle = "rgba(134, 239, 172, 0.34)";
  ctx.lineWidth = 3;

  for (let i = 0; i < 34; i += 1) {
    const x = (i * 97) % canvas.width;
    const y = (i * 151) % canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y + 12);
    ctx.lineTo(x + 12, y - 10);
    ctx.moveTo(x + 6, y + 2);
    ctx.lineTo(x - 8, y - 2);
    ctx.moveTo(x + 10, y - 4);
    ctx.lineTo(x + 22, y - 2);
    ctx.stroke();
  }
}

function drawRocks() {
  ctx.fillStyle = "rgba(64, 84, 91, 0.42)";

  for (let i = 0; i < 18; i += 1) {
    const x = (i * 133 + 41) % canvas.width;
    const y = (i * 89 + 67) % canvas.height;
    ctx.beginPath();
    ctx.ellipse(x, y, 13 + (i % 4), 8 + (i % 3), 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFoods() {
  foods.forEach((food) => {
    const x = food.x * gridSize;
    const y = food.y * gridSize;
    if (food.kind === "leaf") {
      drawLeaf(x, y);
    } else {
      drawMeat(x, y);
    }
  });
}

function drawPoops() {
  poops.forEach((poop) => {
    const x = poop.x * gridSize + gridSize / 2;
    const y = poop.y * gridSize + gridSize / 2;
    const bounce = Math.sin(performance.now() / 260 + poop.wiggle) * 1.4;

    ctx.save();
    ctx.translate(x, y + bounce);
    ctx.fillStyle = "#7c3f18";
    ctx.beginPath();
    ctx.ellipse(0, 8, 13, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(-2, 1, 10, 7, 0, 0, Math.PI * 2);
    ctx.ellipse(3, -6, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#a16207";
    ctx.beginPath();
    ctx.arc(-4, -1, 2, 0, Math.PI * 2);
    ctx.arc(5, 5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawLeaf(x, y) {
  ctx.save();
  ctx.translate(x + gridSize / 2, y + gridSize / 2);
  ctx.rotate(-0.6);
  ctx.fillStyle = "#86efac";
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#166534";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(0, -14);
  ctx.moveTo(0, 2);
  ctx.lineTo(8, -5);
  ctx.moveTo(0, 6);
  ctx.lineTo(-7, 0);
  ctx.stroke();
  ctx.restore();
}

function drawMeat(x, y) {
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.roundRect(x + 11, y + 13, 25, 20, 9);
  ctx.fill();

  ctx.fillStyle = "#fef2f2";
  ctx.beginPath();
  ctx.arc(x + 11, y + 17, 5, 0, Math.PI * 2);
  ctx.arc(x + 10, y + 29, 5, 0, Math.PI * 2);
  ctx.fillRect(x + 9, y + 16, 9, 14);
  ctx.fill();
}

function drawDino() {
  const info = dinoTypes[selectedDino];
  const x = dino.x * gridSize;
  const y = dino.y * gridSize;

  ctx.save();
  ctx.translate(x + gridSize / 2, y + gridSize / 2);
  if (direction.x === -1) ctx.rotate(Math.PI);
  if (direction.y === 1) ctx.rotate(Math.PI / 2);
  if (direction.y === -1) ctx.rotate(-Math.PI / 2);

  if (selectedDino === "triceratops") {
    drawTriceratops(info);
  } else if (selectedDino === "stegosaurus") {
    drawStegosaurus(info);
  } else if (selectedDino === "bronto") {
    drawBronto(info);
  } else {
    drawTrex(info);
  }

  ctx.restore();
}

function drawTrex(info) {
  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.roundRect(-20, -11, 28, 22, 11);
  ctx.roundRect(3, -18, 25, 19, 7);
  ctx.fill();

  ctx.fillStyle = info.accent;
  ctx.beginPath();
  ctx.moveTo(-17, 0);
  ctx.lineTo(-34, -10);
  ctx.lineTo(-22, 11);
  ctx.fill();

  ctx.strokeStyle = info.accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-2, -11);
  ctx.lineTo(-7, -18);
  ctx.moveTo(6, -13);
  ctx.lineTo(2, -21);
  ctx.stroke();

  ctx.strokeStyle = info.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(8, 9);
  ctx.moveTo(4, 1);
  ctx.lineTo(13, 8);
  ctx.stroke();

  drawDinoLegs(info.color);
  drawDinoEye(17, -9);
  drawDinoTeeth(22, -1);
}

function drawTriceratops(info) {
  ctx.fillStyle = info.accent;
  ctx.beginPath();
  ctx.ellipse(7, -3, 16, 19, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.roundRect(-18, -10, 28, 20, 9);
  ctx.roundRect(7, -11, 19, 15, 7);
  ctx.fill();

  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(17, -11);
  ctx.lineTo(25, -22);
  ctx.moveTo(21, -3);
  ctx.lineTo(32, -4);
  ctx.moveTo(10, -12);
  ctx.lineTo(5, -25);
  ctx.stroke();

  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.moveTo(-17, 0);
  ctx.lineTo(-28, -6);
  ctx.lineTo(-20, 9);
  ctx.fill();

  drawDinoLegs(info.color);
  drawDinoEye(18, -7);
}

function drawStegosaurus(info) {
  ctx.fillStyle = info.accent;
  for (let i = 0; i < 5; i += 1) {
    ctx.beginPath();
    ctx.moveTo(-16 + i * 8, -9);
    ctx.lineTo(-12 + i * 8, -25 + Math.abs(2 - i) * 2);
    ctx.lineTo(-7 + i * 8, -9);
    ctx.fill();
  }

  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.roundRect(-23, -7, 37, 18, 10);
  ctx.roundRect(11, -8, 13, 12, 5);
  ctx.fill();

  ctx.strokeStyle = info.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-20, 1);
  ctx.lineTo(-34, -6);
  ctx.stroke();

  drawDinoLegs(info.color);
  drawDinoEye(18, -5);
}

function drawBronto(info) {
  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.roundRect(-25, -3, 35, 19, 10);
  ctx.fill();

  ctx.strokeStyle = info.color;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.quadraticCurveTo(15, -24, 27, -27);
  ctx.stroke();

  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.roundRect(21, -34, 17, 12, 6);
  ctx.fill();

  ctx.strokeStyle = info.accent;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-21, 2);
  ctx.lineTo(-37, -9);
  ctx.stroke();

  drawDinoLegs(info.color);
  drawDinoEye(32, -30);
}

function drawDinoLegs(color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-7, 8);
  ctx.lineTo(-11, 21);
  ctx.moveTo(8, 8);
  ctx.lineTo(14, 21);
  ctx.stroke();
}

function drawDinoEye(x, y) {
  ctx.fillStyle = "#07111f";
  ctx.beginPath();
  ctx.arc(x, y, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDinoTeeth(x, y) {
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x + 3, y + 7);
  ctx.fill();
}

function drawBugs() {
  bugs.forEach((bug) => {
    ctx.save();
    ctx.translate(bug.x, bug.y);
    ctx.rotate(Math.sin(bug.wing) * 0.7);
    ctx.fillStyle = "rgba(248, 250, 252, 0.74)";
    ctx.beginPath();
    ctx.ellipse(-4, -3, 4, 2, -0.6, 0, Math.PI * 2);
    ctx.ellipse(4, -3, 4, 2, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = bug.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawSticks() {
  sticks.forEach((stick) => {
    const fade = Math.max(0, Math.min(1, stick.life / 24));

    ctx.save();
    ctx.translate(stick.x, stick.y);
    ctx.rotate(stick.angle);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-stick.length / 2, 0);
    ctx.lineTo(stick.length / 2, 0);
    ctx.stroke();

    ctx.strokeStyle = "#ca8a04";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(stick.length * 0.15, 0);
    ctx.lineTo(stick.length * 0.35, -5);
    ctx.moveTo(-stick.length * 0.2, 0);
    ctx.lineTo(-stick.length * 0.36, 4);
    ctx.stroke();
    ctx.restore();
  });
}

function drawSnakeBursts() {
  snakeBursts.forEach((snake) => {
    const fade = Math.max(0, Math.min(1, snake.life / 24));
    const angle = Math.atan2(snake.vy, snake.vx);

    ctx.save();
    ctx.translate(snake.x, snake.y);
    ctx.rotate(angle);
    ctx.globalAlpha = fade;
    ctx.strokeStyle = snake.color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();

    for (let i = 0; i < 5; i += 1) {
      const x = -12 + i * 6;
      const y = Math.sin(snake.wiggle + i * 1.2) * 4;
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.fillStyle = "#07111f";
    ctx.beginPath();
    ctx.arc(14, -2, 1.5, 0, Math.PI * 2);
    ctx.arc(14, 3, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function chooseDino(type) {
  ensureAudio();
  selectedDino = type;
  dinoButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.dino === type);
  });
  statusEl.textContent = `${dinoTypes[selectedDino].label} likes ${foodLabel(dinoTypes[selectedDino].diet)}.`;
  playSound("select");
  draw();
}

window.addEventListener("keydown", (event) => {
  const directions = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  if (!directions[event.key]) return;
  event.preventDefault();
  ensureAudio();
  setDirection(directions[event.key]);
});

dinoButtons.forEach((button) => {
  button.addEventListener("click", () => chooseDino(button.dataset.dino));
});
restartButton.addEventListener("click", () => {
  ensureAudio();
  playSound("select");
  resetGame();
});
soundButton.addEventListener("click", () => {
  ensureAudio();
  playSound("select");
});
canvas.addEventListener("pointerdown", startTouchControl);
canvas.addEventListener("pointermove", steerTowardPointer);
canvas.addEventListener("pointerup", stopTouchControl);
canvas.addEventListener("pointercancel", stopTouchControl);

resetGame();
