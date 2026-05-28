const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const statusEl = document.querySelector("#status");
const restartButton = document.querySelector("#restart");

const mouseCount = 6;
const snakeSpeed = 3.8;
const mouseSpeed = 1.8;
const normalRadius = 12;
const bigRadius = 24;
const segmentSpacing = 12;
const startSegments = 18;
const growSegments = 8;
const bigGrowSegments = 14;
const catchDistance = 34;
const powerDistance = 36;
const powerDurationMs = 10000;
const burstDuration = 78;

let snake;
let direction;
let targetPosition;
let touchPointerId;
let mice;
let frogPowerup;
let bursts;
let score;
let poweredUntil;
let lastTime;
let animationId;

function resetGame() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  snake = [];
  for (let i = 0; i < startSegments; i += 1) {
    snake.push({ x: centerX - i * segmentSpacing, y: centerY });
  }

  direction = { x: 1, y: 0 };
  targetPosition = null;
  touchPointerId = null;
  mice = [];
  bursts = [];
  score = 0;
  poweredUntil = 0;
  lastTime = performance.now();
  scoreEl.textContent = score;
  statusEl.textContent = "Touch and hold where your snake should go.";
  placeMice();
  placeFrogPowerup();
  startAnimation();
}

function placeMice() {
  while (mice.length < mouseCount) {
    mice.push(createMouse());
  }
}

function createMouse() {
  const padding = 70;
  return {
    x: padding + Math.random() * (canvas.width - padding * 2),
    y: padding + Math.random() * (canvas.height - padding * 2),
    angle: Math.random() * Math.PI * 2,
    turnTimer: 15 + Math.random() * 45,
    color: ["#cbd5e1", "#a8a29e", "#e7e5e4", "#94a3b8"][mice.length % 4],
  };
}

function placeFrogPowerup() {
  const padding = 80;
  frogPowerup = {
    x: padding + Math.random() * (canvas.width - padding * 2),
    y: padding + Math.random() * (canvas.height - padding * 2),
    pulse: Math.random() * Math.PI * 2,
  };
}

function startAnimation() {
  if (animationId) return;

  function animate(time) {
    const delta = Math.min(2, (time - lastTime) / 16.67);
    lastTime = time;
    update(delta, time);
    draw(time);
    animationId = requestAnimationFrame(animate);
  }

  animationId = requestAnimationFrame(animate);
}

function update(delta, time) {
  updateSnake(delta, time);
  updateMice(delta);
  updateBursts(delta);
  checkFrogPowerup(time);
  checkMouseCatches(time);
}

function updateSnake(delta, time) {
  const head = snake[0];

  if (targetPosition) {
    const deltaX = targetPosition.x - head.x;
    const deltaY = targetPosition.y - head.y;
    const distance = Math.hypot(deltaX, deltaY);

    if (distance > 4) {
      direction = {
        x: deltaX / distance,
        y: deltaY / distance,
      };
    }
  }

  const speed = (isPowered(time) ? snakeSpeed * 1.15 : snakeSpeed) * delta;
  const newHead = {
    x: wrapValue(head.x + direction.x * speed, canvas.width),
    y: wrapValue(head.y + direction.y * speed, canvas.height),
  };

  snake.unshift(newHead);

  const wantedLength = snake.wantedLength || startSegments;
  while (snake.length > wantedLength) {
    snake.pop();
  }
}

function updateMice(delta) {
  mice.forEach((mouse) => {
    mouse.turnTimer -= delta;
    if (mouse.turnTimer <= 0) {
      mouse.angle = roamingAngle(mouse, 100, 2.5);
      mouse.turnTimer = 16 + Math.random() * 42;
    }

    mouse.x += Math.cos(mouse.angle) * mouseSpeed * delta;
    mouse.y += Math.sin(mouse.angle) * mouseSpeed * delta;

    if (mouse.x < 34 || mouse.x > canvas.width - 34) {
      mouse.angle = Math.PI - mouse.angle;
    }
    if (mouse.y < 34 || mouse.y > canvas.height - 34) {
      mouse.angle = -mouse.angle;
    }

    mouse.x = clamp(mouse.x, 34, canvas.width - 34);
    mouse.y = clamp(mouse.y, 34, canvas.height - 34);
  });
}

function roamingAngle(creature, edgePadding, wanderAmount) {
  const head = snake[0];
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const nearEdge =
    creature.x < edgePadding ||
    creature.x > canvas.width - edgePadding ||
    creature.y < edgePadding ||
    creature.y > canvas.height - edgePadding;

  if (nearEdge) {
    return Math.atan2(centerY - creature.y, centerX - creature.x) + (Math.random() - 0.5) * 0.9;
  }

  const awayFromSnake = Math.atan2(creature.y - head.y, creature.x - head.x);
  const randomWander = creature.angle + (Math.random() - 0.5) * wanderAmount;
  const snakeDistance = Math.hypot(creature.x - head.x, creature.y - head.y);

  if (snakeDistance < 170) {
    return awayFromSnake * 0.68 + randomWander * 0.32;
  }

  return randomWander;
}

function updateBursts(delta) {
  bursts = bursts
    .map((burst) => ({
      ...burst,
      x: burst.x + burst.vx * delta,
      y: burst.y + burst.vy * delta,
      vx: burst.vx * 0.985,
      vy: burst.vy * 0.985,
      flap: burst.flap + 0.42 * delta,
      life: burst.life - delta,
    }))
    .filter((burst) => burst.life > 0);
}

function checkFrogPowerup(time) {
  if (!frogPowerup) return;

  const head = snake[0];
  const distance = Math.hypot(frogPowerup.x - head.x, frogPowerup.y - head.y);
  if (distance > powerDistance) return;

  poweredUntil = time + powerDurationMs;
  snake.wantedLength = Math.max(snake.wantedLength || startSegments, snake.length + bigGrowSegments);
  frogPowerup = null;
  statusEl.textContent = "Big snake! Cats are coming!";
}

function checkMouseCatches(time) {
  const head = snake[0];
  const radius = isPowered(time) ? bigRadius : normalRadius;

  for (let i = mice.length - 1; i >= 0; i -= 1) {
    const mouse = mice[i];
    const distance = Math.hypot(mouse.x - head.x, mouse.y - head.y);

    if (distance <= catchDistance + radius * 0.35) {
      mice.splice(i, 1);
      score += 1;
      scoreEl.textContent = score;
      snake.wantedLength = (snake.wantedLength || snake.length) + (isPowered(time) ? bigGrowSegments : growSegments);
      spawnBurst(isPowered(time) ? "cat" : "frog");
      statusEl.textContent = isPowered(time) ? "Cats!" : "Frogs!";
      mice.push(createMouse());
    }
  }

  if (!frogPowerup && !isPowered(time)) {
    placeFrogPowerup();
    statusEl.textContent = "Frog powerup is back.";
  }
}

function spawnBurst(kind) {
  const head = snake[0];
  const mouthX = head.x + direction.x * 26;
  const mouthY = head.y + direction.y * 26;

  for (let i = 0; i < 8; i += 1) {
    const angle = Math.atan2(direction.y, direction.x) + (Math.random() - 0.5) * 1.8;
    const speed = 3.2 + Math.random() * 4.8;
    bursts.push({
      kind,
      x: mouthX,
      y: mouthY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: burstDuration + Math.random() * 24,
      flap: Math.random() * Math.PI * 2,
      size: 0.8 + Math.random() * 0.45,
      color:
        kind === "cat"
          ? ["#f9a8d4", "#fbbf24", "#e5e7eb", "#fb923c"][i % 4]
          : ["#22c55e", "#84cc16", "#16a34a", "#bef264"][i % 4],
    });
  }
}

function isPowered(time) {
  return time < poweredUntil;
}

function draw(time) {
  drawBackground();
  drawFrogPowerup(time);
  drawMice();
  drawSnake(time);
  drawBursts();
}

function drawBackground() {
  ctx.fillStyle = "#101728";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 72) {
    for (let x = 0; x < canvas.width; x += 72) {
      ctx.fillStyle = (x / 72 + y / 72) % 2 === 0 ? "#142033" : "#101a2b";
      ctx.fillRect(x, y, 72, 72);
    }
  }

  ctx.fillStyle = "rgba(163, 230, 53, 0.18)";
  for (let i = 0; i < 20; i += 1) {
    const x = (i * 113 + 45) % canvas.width;
    const y = (i * 79 + 110) % canvas.height;
    ctx.beginPath();
    ctx.ellipse(x, y, 22 + (i % 3) * 8, 9, 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFrogPowerup(time) {
  if (!frogPowerup) return;

  frogPowerup.pulse += 0.08;
  const bounce = Math.sin(frogPowerup.pulse) * 4;

  ctx.save();
  ctx.translate(frogPowerup.x, frogPowerup.y + bounce);
  ctx.scale(0.9 + Math.sin(frogPowerup.pulse) * 0.05, 0.9 + Math.sin(frogPowerup.pulse) * 0.05);

  ctx.fillStyle = "rgba(190, 242, 100, 0.24)";
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.fill();

  drawTinyFrog(0, 0, 1.15);
  ctx.restore();
}

function drawMice() {
  mice.forEach((mouse) => {
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    ctx.rotate(mouse.angle);

    ctx.strokeStyle = "#71717a";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-18, 7);
    ctx.quadraticCurveTo(-42, 10, -50, 28);
    ctx.stroke();

    ctx.fillStyle = mouse.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(18, -11, 9, 0, Math.PI * 2);
    ctx.arc(18, 11, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fda4af";
    ctx.beginPath();
    ctx.arc(27, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(11, -6, 2.5, 0, Math.PI * 2);
    ctx.arc(11, 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawSnake(time) {
  const powered = isPowered(time);
  const radius = powered ? bigRadius : normalRadius;
  const head = snake[0];

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let i = snake.length - 1; i >= 1; i -= 1) {
    const segment = snake[i];
    const age = i / snake.length;
    ctx.fillStyle = powered
      ? `rgba(190, 242, 100, ${0.82 - age * 0.22})`
      : `rgba(34, 197, 94, ${0.84 - age * 0.2})`;
    ctx.beginPath();
    ctx.arc(segment.x, segment.y, radius * (1 - age * 0.24), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(Math.atan2(direction.y, direction.x));

  ctx.fillStyle = powered ? "#bef264" : "#22c55e";
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.25, radius, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(radius * 0.45, -radius * 0.48, radius * 0.25, 0, Math.PI * 2);
  ctx.arc(radius * 0.45, radius * 0.48, radius * 0.25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(radius * 0.52, -radius * 0.48, radius * 0.11, 0, Math.PI * 2);
  ctx.arc(radius * 0.52, radius * 0.48, radius * 0.11, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#f472b6";
  ctx.lineWidth = powered ? 6 : 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(radius * 0.95, 0);
  ctx.lineTo(radius * 1.45, 0);
  ctx.stroke();
  ctx.restore();
}

function drawBursts() {
  bursts.forEach((burst) => {
    const fade = Math.max(0, Math.min(1, burst.life / 26));
    const angle = Math.atan2(burst.vy, burst.vx);

    ctx.save();
    ctx.translate(burst.x, burst.y);
    ctx.rotate(angle);
    ctx.scale(burst.size, burst.size);
    ctx.globalAlpha = fade;

    if (burst.kind === "cat") {
      drawTinyCat(0, 0, burst.color);
    } else {
      drawTinyFrog(0, 0, 0.8, burst.color);
    }

    ctx.restore();
  });
}

function drawTinyFrog(x, y, scale = 1, color = "#22c55e") {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
  ctx.arc(10, -11, 9, 0, Math.PI * 2);
  ctx.arc(10, 11, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(13, -11, 4, 0, Math.PI * 2);
  ctx.arc(13, 11, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(14, -11, 2, 0, Math.PI * 2);
  ctx.arc(14, 11, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTinyCat(x, y, color) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(-3, 0, 18, 12, 0, 0, Math.PI * 2);
  ctx.roundRect(10, -12, 18, 24, 8);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(14, -11);
  ctx.lineTo(18, -23);
  ctx.lineTo(23, -11);
  ctx.moveTo(24, -11);
  ctx.lineTo(30, -22);
  ctx.lineTo(31, -8);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-19, 2);
  ctx.quadraticCurveTo(-34, -6, -24, -19);
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(20, -4, 2, 0, Math.PI * 2);
  ctx.arc(20, 4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function steerTowardPointer(event) {
  event.preventDefault();

  if (event.pointerType === "touch" && touchPointerId !== event.pointerId) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  targetPosition = {
    x: (event.clientX - rect.left) * scale,
    y: (event.clientY - rect.top) * scale,
  };
}

function startTouchControl(event) {
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
  targetPosition = null;
  statusEl.textContent = "Touch and hold where your snake should go.";
}

function handleKeydown(event) {
  const keys = {
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
  };

  if (!keys[event.key]) return;

  event.preventDefault();
  targetPosition = null;
  direction = keys[event.key];
  statusEl.textContent = "Catch the mice.";
}

function wrapValue(value, max) {
  if (value < 0) return value + max;
  if (value >= max) return value - max;
  return value;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

restartButton.addEventListener("click", resetGame);
canvas.addEventListener("pointerdown", startTouchControl);
canvas.addEventListener("pointermove", steerTowardPointer);
canvas.addEventListener("pointerup", stopTouchControl);
canvas.addEventListener("pointercancel", stopTouchControl);
window.addEventListener("keydown", handleKeydown);

resetGame();
