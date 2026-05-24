const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const statusEl = document.querySelector("#status");
const restartButton = document.querySelector("#restart");

const gridSize = 40;
const tileCount = canvas.width / gridSize;
const tickMs = 105;
const dinoCount = 10;
const winScore = 20;
const petModeMs = 8000;
const bugModeMs = 7000;
const catChance = 0.5;
const poopSpawnChance = 0.08;
const dinoTypes = ["trex", "triceratops", "stegosaurus", "pterodactyl", "sauropod"];
const catTypes = ["tabby", "tuxedo", "calico", "orange", "gray"];
const dogTypes = ["beagle", "spotty", "brown", "golden", "husky"];
const startSnake = [
  { x: 5, y: 7 },
  { x: 4, y: 7 },
  { x: 3, y: 7 },
];

let snake;
let dinos;
let direction;
let nextDirection;
let score;
let running;
let timerId;
let pointerPosition;
let touchPointerId;
let won;
let winAnimationId;
let winStartedAt;
let egg;
let poop;
let petMode;
let petModeTimerId;
let bugMode;
let bugModeTimerId;
let audioContext;

function ensureAudio() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function playTone(frequency, duration = 0.1, type = "sine", volume = 0.07, delay = 0) {
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

function playSound(name) {
  if (!audioContext) return;

  if (name === "eat") {
    playTone(520, 0.07, "triangle", 0.07);
    playTone(720, 0.08, "triangle", 0.06, 0.05);
  } else if (name === "egg") {
    playTone(330, 0.08, "sine", 0.07);
    playTone(660, 0.12, "sine", 0.06, 0.08);
    playTone(990, 0.1, "sine", 0.05, 0.16);
  } else if (name === "dogs") {
    playTone(220, 0.08, "square", 0.06);
    playTone(180, 0.08, "square", 0.055, 0.1);
  } else if (name === "win") {
    [440, 554, 659, 880].forEach((frequency, index) => {
      playTone(frequency, 0.16, "triangle", 0.065, index * 0.08);
    });
  } else if (name === "select") {
    playTone(360, 0.06, "sine", 0.045);
  }
}

function resetGame() {
  snake = startSnake.map((segment) => ({ ...segment }));
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  running = false;
  pointerPosition = null;
  touchPointerId = null;
  won = false;
  egg = null;
  poop = null;
  petMode = false;
  bugMode = false;
  stopPetModeTimer();
  stopBugModeTimer();
  stopWinAnimation();
  scoreEl.textContent = score;
  statusEl.textContent = "Touch and hold where you want the snake to go.";
  placeDinos();
  placeEgg();
  maybePlacePoop();
  stopLoop();
  draw();
}

function startLoop() {
  if (running) return;
  running = true;
  statusEl.textContent = "Keep going.";
  timerId = window.setInterval(tick, tickMs);
}

function stopLoop() {
  if (timerId) {
    window.clearInterval(timerId);
    timerId = null;
  }
  running = false;
}

function winGame() {
  won = true;
  pointerPosition = null;
  touchPointerId = null;
  egg = null;
  poop = null;
  petMode = false;
  bugMode = false;
  stopPetModeTimer();
  stopBugModeTimer();
  stopLoop();
  statusEl.textContent = "You win! Press Restart to play again.";
  playSound("win");
  startWinAnimation();
}

function tick() {
  if (won) return;

  steerTowardLastPointer();
  direction = nextDirection;
  const head = snake[0];
  const nextHead = {
    x: wrapCoordinate(head.x + direction.x),
    y: wrapCoordinate(head.y + direction.y),
  };

  snake.unshift(nextHead);

  const eatenDinoIndex = dinos.findIndex(
    (dino) => nextHead.x === dino.x && nextHead.y === dino.y,
  );
  const ateEgg = egg && nextHead.x === egg.x && nextHead.y === egg.y;
  const atePoop = poop && nextHead.x === poop.x && nextHead.y === poop.y;

  if (eatenDinoIndex !== -1) {
    score += 1;
    scoreEl.textContent = score;
    dinos.splice(eatenDinoIndex, 1);
    playSound("eat");

    if (score < winScore) {
      placeDino();
    } else if (dinos.length === 0) {
      winGame();
      return;
    } else {
      statusEl.textContent = `Almost there. ${dinos.length} dinos left.`;
    }
  } else if (ateEgg) {
    egg = null;
    activatePetMode();
    playSound("egg");
    snake.pop();
  } else if (atePoop) {
    poop = null;
    score += 1;
    scoreEl.textContent = score;
    playSound("eat");
    activateBugMode();
    if (score >= winScore && dinos.length === 0) {
      winGame();
      return;
    }
  } else {
    snake.pop();
  }

  maybePlaceEgg();
  maybePlacePoop();
  draw();
}

function placeDinos() {
  dinos = [];

  while (dinos.length < dinoCount) {
    if (!placeDino()) break;
  }
}

function placeDino() {
  const openCells = [];

  for (let y = 0; y < tileCount; y += 1) {
    for (let x = 0; x < tileCount; x += 1) {
      if (!isOccupied({ x, y })) {
        openCells.push({ x, y });
      }
    }
  }

  if (openCells.length === 0) return false;

  const dino = openCells[Math.floor(Math.random() * openCells.length)];
  dino.type = dinoTypes[Math.floor(Math.random() * dinoTypes.length)];

  dinos.push(dino);
  return true;
}

function maybePlaceEgg() {
  if (egg || petMode || won) return;

  placeEgg();
}

function placeEgg() {
  if (petMode || won) return false;

  const openCells = [];

  for (let y = 0; y < tileCount; y += 1) {
    for (let x = 0; x < tileCount; x += 1) {
      if (!isOccupied({ x, y })) {
        openCells.push({ x, y });
      }
    }
  }

  if (openCells.length === 0) return false;

  egg = openCells[Math.floor(Math.random() * openCells.length)];
  return true;
}

function maybePlacePoop() {
  if (poop || won) return;

  if (Math.random() < poopSpawnChance) {
    placePoop();
  }
}

function placePoop() {
  const openCells = [];

  for (let y = 0; y < tileCount; y += 1) {
    for (let x = 0; x < tileCount; x += 1) {
      if (!isOccupied({ x, y })) {
        openCells.push({ x, y });
      }
    }
  }

  if (openCells.length === 0) return false;

  poop = {
    ...openCells[Math.floor(Math.random() * openCells.length)],
    wiggle: Math.random() * Math.PI * 2,
  };
  return true;
}

function activatePetMode() {
  petMode = true;
  stopPetModeTimer();
  dinos.forEach((dino) => {
    dino.petType = Math.random() < catChance ? "cat" : "dog";
  });
  statusEl.textContent = "Cats and dogs! Catch them before they turn back.";

  petModeTimerId = window.setTimeout(() => {
    petMode = false;
    petModeTimerId = null;
    dinos.forEach((dino) => {
      delete dino.petType;
    });
    statusEl.textContent = "The dinos are back.";
    placeEgg();
    draw();
  }, petModeMs);
}

function activateBugMode() {
  bugMode = true;
  stopBugModeTimer();
  statusEl.textContent = "Bugs! Catch the bugs!";

  bugModeTimerId = window.setTimeout(() => {
    bugMode = false;
    bugModeTimerId = null;
    statusEl.textContent = petMode ? "Cats and dogs are back." : "The dinos are back.";
    draw();
  }, bugModeMs);
}

function stopPetModeTimer() {
  if (petModeTimerId) {
    window.clearTimeout(petModeTimerId);
    petModeTimerId = null;
  }
}

function stopBugModeTimer() {
  if (bugModeTimerId) {
    window.clearTimeout(bugModeTimerId);
    bugModeTimerId = null;
  }
}

function isOccupied(position) {
  return (
    snake.some((segment) => segment.x === position.x && segment.y === position.y) ||
    dinos.some((dino) => dino.x === position.x && dino.y === position.y) ||
    Boolean(egg && egg.x === position.x && egg.y === position.y) ||
    Boolean(poop && poop.x === position.x && poop.y === position.y)
  );
}

function wrapCoordinate(value) {
  if (value < 0) return tileCount - 1;
  if (value >= tileCount) return 0;
  return value;
}

function setDirection(newDirection) {
  if (won) return false;

  nextDirection = newDirection;
  startLoop();
  return true;
}

function steerTowardPointer(event) {
  event.preventDefault();
  ensureAudio();

  if (won) return;

  if (event.pointerType === "touch" && touchPointerId !== event.pointerId) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  pointerPosition = {
    x: (event.clientX - rect.left) * scale,
    y: (event.clientY - rect.top) * scale,
  };
  steerTowardLastPointer();
  startLoop();
}

function startTouchControl(event) {
  ensureAudio();

  if (won) return;

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
  statusEl.textContent = "Touch and hold where you want the snake to go.";
}

function steerTowardLastPointer() {
  if (!pointerPosition) return;

  const head = {
    x: snake[0].x * gridSize + gridSize / 2,
    y: snake[0].y * gridSize + gridSize / 2,
  };
  const deltaX = pointerPosition.x - head.x;
  const deltaY = pointerPosition.y - head.y;

  if (Math.abs(deltaX) < gridSize / 2 && Math.abs(deltaY) < gridSize / 2) {
    return;
  }

  const horizontalDirection = { x: Math.sign(deltaX), y: 0 };
  const verticalDirection = { x: 0, y: Math.sign(deltaY) };
  const preferredDirection =
    Math.abs(deltaX) >= Math.abs(deltaY) ? horizontalDirection : verticalDirection;

  if (preferredDirection.x !== 0 || preferredDirection.y !== 0) {
    setDirection(preferredDirection);
  }
}

function draw() {
  drawBoard();
  drawEgg();
  drawPoop();
  drawDino();
  drawSnake();

  if (won) {
    drawWinOverlay(performance.now());
  }
}

function drawBoard() {
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < tileCount; row += 1) {
    for (let col = 0; col < tileCount; col += 1) {
      ctx.fillStyle = (row + col) % 2 === 0 ? "#111b2f" : "#0e1729";
      ctx.fillRect(col * gridSize, row * gridSize, gridSize, gridSize);
    }
  }
}

function drawEgg() {
  if (!egg || won) return;

  const x = egg.x * gridSize;
  const y = egg.y * gridSize;
  const centerX = x + gridSize / 2;
  const centerY = y + gridSize / 2;
  const pulse = 1 + Math.sin(performance.now() / 170) * 0.08;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = "rgba(251, 191, 36, 0.24)";
  ctx.beginPath();
  ctx.arc(0, 0, gridSize * 0.46, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.ellipse(0, 1, gridSize * 0.25, gridSize * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fbbf24";
  ctx.beginPath();
  ctx.arc(-7, -5, 3, 0, Math.PI * 2);
  ctx.arc(5, 2, 3, 0, Math.PI * 2);
  ctx.arc(-2, 8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPoop() {
  if (!poop || won) return;

  const x = poop.x * gridSize + gridSize / 2;
  const y = poop.y * gridSize + gridSize / 2;
  const bounce = Math.sin(performance.now() / 250 + poop.wiggle) * 1.2;

  ctx.save();
  ctx.translate(x, y + bounce);
  ctx.fillStyle = "rgba(124, 63, 24, 0.22)";
  ctx.beginPath();
  ctx.arc(0, 0, gridSize * 0.44, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#7c3f18";
  ctx.beginPath();
  ctx.ellipse(0, 9, 14, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(-2, 2, 10, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(4, -6, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#a16207";
  ctx.beginPath();
  ctx.arc(-5, 1, 2, 0, Math.PI * 2);
  ctx.arc(6, 6, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDino() {
  dinos.forEach((dino, index) => {
    if (bugMode) {
      drawBugAt(dino, index);
    } else if (petMode && dino.petType === "dog") {
      drawDogAt(dino, index);
    } else if (petMode) {
      drawCatAt(dino, index);
    } else {
      drawDinoAt(dino, index);
    }
  });
}

function drawBugAt(bug, index) {
  const x = bug.x * gridSize;
  const y = bug.y * gridSize;
  const centerX = x + gridSize / 2;
  const centerY = y + gridSize / 2;
  const colors = ["#0f172a", "#7f1d1d", "#365314", "#78350f", "#1e3a8a"];
  const wing = Math.sin(performance.now() / 90 + index) * 0.9;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(wing * 0.12);

  ctx.fillStyle = "rgba(248, 250, 252, 0.72)";
  ctx.beginPath();
  ctx.ellipse(-8, -6 + wing, 9, 5, -0.55, 0, Math.PI * 2);
  ctx.ellipse(8, -6 - wing, 9, 5, 0.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors[index % colors.length];
  ctx.beginPath();
  ctx.ellipse(0, 1, 8, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colors[index % colors.length];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, 6);
  ctx.lineTo(-14, 14);
  ctx.moveTo(0, 8);
  ctx.lineTo(0, 18);
  ctx.moveTo(5, 6);
  ctx.lineTo(14, 14);
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(-3, -5, 2, 0, Math.PI * 2);
  ctx.arc(3, -5, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDinoAt(dino, index) {
  const x = dino.x * gridSize;
  const y = dino.y * gridSize;
  const spriteSize = 24;
  const spriteScale = (gridSize - 4) / spriteSize;
  const spriteOffset = (gridSize - spriteSize * spriteScale) / 2;
  const colors = [
    { body: "#fbbf24", accent: "#f97316", dark: "#7c2d12" },
    { body: "#22c55e", accent: "#15803d", dark: "#052e16" },
    { body: "#38bdf8", accent: "#0284c7", dark: "#082f49" },
    { body: "#fb7185", accent: "#be123c", dark: "#4c0519" },
    { body: "#a78bfa", accent: "#7c3aed", dark: "#2e1065" },
  ][index % 5];

  ctx.save();
  ctx.translate(x + spriteOffset, y + spriteOffset);
  ctx.scale(spriteScale, spriteScale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (dino.type === "triceratops") {
    drawTriceratops(0, 0, colors);
  } else if (dino.type === "stegosaurus") {
    drawStegosaurus(0, 0, colors);
  } else if (dino.type === "pterodactyl") {
    drawPterodactyl(0, 0, colors);
  } else if (dino.type === "sauropod") {
    drawSauropod(0, 0, colors);
  } else {
    drawTrex(0, 0, colors);
  }

  ctx.restore();
}

function drawCatAt(cat, index) {
  const x = cat.x * gridSize;
  const y = cat.y * gridSize;
  const spriteSize = 24;
  const spriteScale = (gridSize - 4) / spriteSize;
  const spriteOffset = (gridSize - spriteSize * spriteScale) / 2;
  const catType = catTypes[index % catTypes.length];
  const palettes = {
    tabby: { body: "#a16207", accent: "#fbbf24", dark: "#422006", light: "#fde68a" },
    tuxedo: { body: "#111827", accent: "#f8fafc", dark: "#020617", light: "#f8fafc" },
    calico: { body: "#f8fafc", accent: "#fb923c", dark: "#111827", light: "#fef3c7" },
    orange: { body: "#f97316", accent: "#fed7aa", dark: "#7c2d12", light: "#ffedd5" },
    gray: { body: "#94a3b8", accent: "#cbd5e1", dark: "#1e293b", light: "#e2e8f0" },
  };
  const colors = palettes[catType];

  ctx.save();
  ctx.translate(x + spriteOffset, y + spriteOffset);
  ctx.scale(spriteScale, spriteScale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.roundRect(5, 10, 13, 8, 5);
  ctx.roundRect(13, 6, 8, 8, 4);
  ctx.fill();

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.moveTo(14, 7);
  ctx.lineTo(15, 3);
  ctx.lineTo(18, 7);
  ctx.moveTo(19, 7);
  ctx.lineTo(21, 3);
  ctx.lineTo(22, 9);
  ctx.fill();

  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(6, 13);
  ctx.lineTo(2, 9);
  ctx.lineTo(3, 5);
  ctx.stroke();

  ctx.fillStyle = colors.accent;
  if (catType === "tabby" || catType === "orange") {
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(8 + i * 3, 10, 1.5, 5);
    }
  } else if (catType === "calico") {
    ctx.beginPath();
    ctx.arc(8, 12, 3, 0, Math.PI * 2);
    ctx.arc(17, 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.roundRect(14, 10, 4, 4, 2);
    ctx.fill();
  }

  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 17);
  ctx.lineTo(7, 21);
  ctx.moveTo(15, 17);
  ctx.lineTo(16, 21);
  ctx.stroke();

  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  ctx.arc(16, 10, 1, 0, Math.PI * 2);
  ctx.arc(20, 10, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colors.dark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(18, 12);
  ctx.lineTo(18, 13);
  ctx.moveTo(14, 12);
  ctx.lineTo(10, 11);
  ctx.moveTo(14, 13);
  ctx.lineTo(10, 14);
  ctx.moveTo(21, 12);
  ctx.lineTo(24, 11);
  ctx.moveTo(21, 13);
  ctx.lineTo(24, 14);
  ctx.stroke();

  ctx.restore();
}

function drawDogAt(dog, index) {
  const x = dog.x * gridSize;
  const y = dog.y * gridSize;
  const spriteSize = 24;
  const spriteScale = (gridSize - 4) / spriteSize;
  const spriteOffset = (gridSize - spriteSize * spriteScale) / 2;
  const dogType = dogTypes[index % dogTypes.length];
  const palettes = {
    beagle: { body: "#f5f5dc", accent: "#92400e", dark: "#1f2937", light: "#fef3c7" },
    spotty: { body: "#f8fafc", accent: "#111827", dark: "#020617", light: "#e2e8f0" },
    brown: { body: "#a16207", accent: "#713f12", dark: "#422006", light: "#fef3c7" },
    golden: { body: "#fbbf24", accent: "#d97706", dark: "#78350f", light: "#fde68a" },
    husky: { body: "#cbd5e1", accent: "#475569", dark: "#0f172a", light: "#f8fafc" },
  };
  const colors = palettes[dogType];

  ctx.save();
  ctx.translate(x + spriteOffset, y + spriteOffset);
  ctx.scale(spriteScale, spriteScale);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.roundRect(4, 10, 14, 8, 5);
  ctx.roundRect(13, 6, 9, 8, 4);
  ctx.fill();

  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.ellipse(13, 9, 3, 5, -0.4, 0, Math.PI * 2);
  ctx.ellipse(21, 9, 3, 5, 0.4, 0, Math.PI * 2);
  ctx.fill();

  if (dogType === "spotty") {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(8, 12, 2.5, 0, Math.PI * 2);
    ctx.arc(14, 15, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (dogType === "husky") {
    ctx.fillStyle = colors.light;
    ctx.beginPath();
    ctx.roundRect(15, 8, 5, 4, 2);
    ctx.fill();
  }

  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(5, 13);
  ctx.lineTo(2, 9);
  ctx.stroke();

  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(8, 17);
  ctx.lineTo(7, 21);
  ctx.moveTo(15, 17);
  ctx.lineTo(16, 21);
  ctx.stroke();

  ctx.fillStyle = colors.dark;
  ctx.beginPath();
  ctx.arc(16, 10, 1, 0, Math.PI * 2);
  ctx.arc(20, 10, 1, 0, Math.PI * 2);
  ctx.arc(19, 12, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = colors.dark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(19, 13);
  ctx.lineTo(17, 14);
  ctx.moveTo(19, 13);
  ctx.lineTo(21, 14);
  ctx.stroke();

  ctx.restore();
}

function drawTrex(x, y, colors) {
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 9, 12, 8, 4);
  ctx.roundRect(x + 13, y + 5, 8, 7, 3);
  ctx.fill();

  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 12);
  ctx.lineTo(x + 1, y + 9);
  ctx.lineTo(x + 5, y + 17);
  ctx.fill();

  drawLegs(x, y, colors.body);
  drawEye(x + 18, y + 8, colors.dark);
  drawTeeth(x + 20, y + 11);
}

function drawTriceratops(x, y, colors) {
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 7, 9, 9, 4);
  ctx.fill();

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.roundRect(x + 6, y + 10, 12, 7, 4);
  ctx.roundRect(x + 14, y + 8, 7, 6, 3);
  ctx.fill();

  ctx.strokeStyle = "#fde68a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 18, y + 8);
  ctx.lineTo(x + 21, y + 4);
  ctx.moveTo(x + 19, y + 10);
  ctx.lineTo(x + 23, y + 9);
  ctx.moveTo(x + 13, y + 9);
  ctx.lineTo(x + 11, y + 5);
  ctx.stroke();

  drawLegs(x + 3, y, colors.body);
  drawEye(x + 18, y + 10, colors.dark);
}

function drawStegosaurus(x, y, colors) {
  ctx.fillStyle = colors.accent;
  for (let i = 0; i < 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(x + 6 + i * 4, y + 9);
    ctx.lineTo(x + 8 + i * 4, y + 4);
    ctx.lineTo(x + 10 + i * 4, y + 9);
    ctx.fill();
  }

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + 10, 15, 8, 5);
  ctx.roundRect(x + 17, y + 9, 5, 5, 2);
  ctx.fill();

  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 13);
  ctx.lineTo(x + 1, y + 11);
  ctx.stroke();

  drawLegs(x + 2, y + 1, colors.body);
  drawEye(x + 20, y + 11, colors.dark);
}

function drawPterodactyl(x, y, colors) {
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 10);
  ctx.lineTo(x + 2, y + 5);
  ctx.lineTo(x + 6, y + 14);
  ctx.lineTo(x + 12, y + 12);
  ctx.lineTo(x + 18, y + 14);
  ctx.lineTo(x + 22, y + 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.roundRect(x + 10, y + 9, 6, 5, 3);
  ctx.moveTo(x + 15, y + 10);
  ctx.lineTo(x + 22, y + 9);
  ctx.lineTo(x + 16, y + 13);
  ctx.fill();

  drawEye(x + 15, y + 10, colors.dark);
}

function drawSauropod(x, y, colors) {
  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 11, 14, 7, 4);
  ctx.fill();

  ctx.strokeStyle = colors.body;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x + 15, y + 12);
  ctx.lineTo(x + 17, y + 6);
  ctx.stroke();

  ctx.fillStyle = colors.body;
  ctx.beginPath();
  ctx.roundRect(x + 16, y + 4, 6, 5, 3);
  ctx.fill();

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 4, y + 13);
  ctx.lineTo(x + 1, y + 9);
  ctx.stroke();

  drawLegs(x + 1, y + 1, colors.body);
  drawEye(x + 20, y + 6, colors.dark);
}

function drawLegs(x, y, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 8, y + 16);
  ctx.lineTo(x + 6, y + 21);
  ctx.moveTo(x + 14, y + 16);
  ctx.lineTo(x + 17, y + 21);
  ctx.stroke();
}

function drawEye(x, y, color = "#07111f") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawTeeth(x, y) {
  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 3, y);
  ctx.lineTo(x + 1, y + 3);
  ctx.fill();
}

function drawSnake() {
  snake.forEach((segment, index) => {
    const x = segment.x * gridSize;
    const y = segment.y * gridSize;
    const hue = (score * 18 + index * 14) % 360;
    ctx.fillStyle = `hsl(${hue} 88% ${index === 0 ? "62%" : "48%"})`;
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, gridSize - 4, gridSize - 4, 7);
    ctx.fill();

    if (index === 0) {
      ctx.fillStyle = "#07111f";
      drawSnakeEye(x + 8, y + 8);
      drawSnakeEye(x + 16, y + 8);
    }
  });
}

function drawSnakeEye(x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

function startWinAnimation() {
  stopWinAnimation();
  winStartedAt = performance.now();

  function animate(now) {
    drawBoard();
    drawSnake();
    drawWinOverlay(now);
    winAnimationId = requestAnimationFrame(animate);
  }

  winAnimationId = requestAnimationFrame(animate);
}

function stopWinAnimation() {
  if (winAnimationId) {
    cancelAnimationFrame(winAnimationId);
    winAnimationId = null;
  }
}

function drawWinOverlay(now) {
  const elapsed = now - winStartedAt;
  const pulse = 1 + Math.sin(elapsed / 180) * 0.08;
  const sparkleOffset = elapsed / 30;

  ctx.fillStyle = "rgba(7, 17, 31, 0.56)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < 36; i += 1) {
    const angle = i * 2.4 + elapsed / 520;
    const radius = 80 + ((i * 31 + sparkleOffset) % 170);
    const x = canvas.width / 2 + Math.cos(angle) * radius;
    const y = canvas.height / 2 + Math.sin(angle * 1.2) * radius;
    ctx.fillStyle = ["#fbbf24", "#22d3ee", "#a3e635", "#fb7185"][i % 4];
    ctx.beginPath();
    ctx.arc(x, y, 4 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(pulse, pulse);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#07111f";
  ctx.font = "900 86px system-ui, sans-serif";
  ctx.strokeText("YOU WIN!", 0, -12);

  const gradient = ctx.createLinearGradient(-210, -70, 210, 50);
  gradient.addColorStop(0, "#a3e635");
  gradient.addColorStop(0.35, "#22d3ee");
  gradient.addColorStop(0.7, "#fbbf24");
  gradient.addColorStop(1, "#fb7185");
  ctx.fillStyle = gradient;
  ctx.fillText("YOU WIN!", 0, -12);

  ctx.font = "700 26px system-ui, sans-serif";
  ctx.lineWidth = 5;
  ctx.strokeText(`Score: ${score}`, 0, 64);
  ctx.fillStyle = "#f8fbff";
  ctx.fillText(`Score: ${score}`, 0, 64);
  ctx.restore();
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

restartButton.addEventListener("click", () => {
  ensureAudio();
  playSound("select");
  resetGame();
});
canvas.addEventListener("pointerdown", startTouchControl);
canvas.addEventListener("pointermove", steerTowardPointer);
canvas.addEventListener("pointerup", stopTouchControl);
canvas.addEventListener("pointercancel", stopTouchControl);

resetGame();
