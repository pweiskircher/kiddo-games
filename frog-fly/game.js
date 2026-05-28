const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const statusEl = document.querySelector("#status");
const restartButton = document.querySelector("#restart");

const flyCount = 7;
const frogSpeed = 4;
const flySpeed = 2.35;
const catchDistance = 42;
const dogDuration = 76;

let frog;
let flies;
let dogs;
let score;
let pointerPosition;
let touchPointerId;
let animationId;

function resetGame() {
  frog = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    angle: 0,
    hop: 0,
  };
  flies = [];
  dogs = [];
  score = 0;
  pointerPosition = null;
  touchPointerId = null;
  scoreEl.textContent = score;
  statusEl.textContent = "Touch and hold where your frog should go.";
  placeFlies();
  startAnimation();
}

function placeFlies() {
  while (flies.length < flyCount) {
    flies.push(createFly());
  }
}

function createFly() {
  const padding = 70;
  return {
    x: padding + Math.random() * (canvas.width - padding * 2),
    y: padding + Math.random() * (canvas.height - padding * 2),
    angle: Math.random() * Math.PI * 2,
    turnTimer: 12 + Math.random() * 38,
    buzz: Math.random() * Math.PI * 2,
    color: ["#111827", "#27272a", "#3f3f46", "#18181b"][flies.length % 4],
  };
}

function startAnimation() {
  if (animationId) return;

  function animate() {
    update();
    draw();
    animationId = requestAnimationFrame(animate);
  }

  animationId = requestAnimationFrame(animate);
}

function update() {
  updateFrog();
  updateFlies();
  updateDogs();
  checkCatches();
}

function updateFrog() {
  frog.hop += pointerPosition ? 0.22 : 0.08;

  if (!pointerPosition) return;

  const deltaX = pointerPosition.x - frog.x;
  const deltaY = pointerPosition.y - frog.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance < 5) return;

  frog.angle = Math.atan2(deltaY, deltaX);
  const hopBoost = 1 + Math.max(0, Math.sin(frog.hop)) * 0.3;
  const step = Math.min(frogSpeed * hopBoost, distance);
  frog.x += (deltaX / distance) * step;
  frog.y += (deltaY / distance) * step;
}

function updateFlies() {
  flies.forEach((fly) => {
    fly.turnTimer -= 1;
    if (fly.turnTimer <= 0) {
      fly.angle = roamingAngle(fly, 100, 2.7);
      fly.turnTimer = 12 + Math.random() * 36;
    }

    fly.buzz += 0.7;
    const buzzAngle = fly.angle + Math.sin(fly.buzz) * 0.55;
    fly.x += Math.cos(buzzAngle) * flySpeed;
    fly.y += Math.sin(buzzAngle) * flySpeed;

    if (fly.x < 30 || fly.x > canvas.width - 30) {
      fly.angle = Math.PI - fly.angle;
    }
    if (fly.y < 30 || fly.y > canvas.height - 30) {
      fly.angle = -fly.angle;
    }

    fly.x = clamp(fly.x, 30, canvas.width - 30);
    fly.y = clamp(fly.y, 30, canvas.height - 30);
  });
}

function roamingAngle(creature, edgePadding, wanderAmount) {
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

  const awayFromFrog = Math.atan2(creature.y - frog.y, creature.x - frog.x);
  const randomWander = creature.angle + (Math.random() - 0.5) * wanderAmount;
  const frogDistance = Math.hypot(creature.x - frog.x, creature.y - frog.y);

  if (frogDistance < 150) {
    return awayFromFrog * 0.62 + randomWander * 0.38;
  }

  return randomWander;
}

function updateDogs() {
  dogs = dogs
    .map((dog) => ({
      ...dog,
      x: dog.x + dog.vx,
      y: dog.y + dog.vy,
      vx: dog.vx * 0.985,
      vy: dog.vy * 0.985,
      wag: dog.wag + 0.44,
      life: dog.life - 1,
    }))
    .filter((dog) => dog.life > 0);
}

function checkCatches() {
  for (let i = flies.length - 1; i >= 0; i -= 1) {
    const fly = flies[i];
    const distance = Math.hypot(fly.x - frog.x, fly.y - frog.y);

    if (distance <= catchDistance) {
      flies.splice(i, 1);
      score += 1;
      scoreEl.textContent = score;
      statusEl.textContent = "Dogs!";
      spawnDogs();
      flies.push(createFly());
    }
  }
}

function spawnDogs() {
  for (let i = 0; i < 8; i += 1) {
    const angle = frog.angle + (Math.random() - 0.5) * 1.7;
    const speed = 3 + Math.random() * 4.8;
    dogs.push({
      x: frog.x + Math.cos(frog.angle) * 35,
      y: frog.y + Math.sin(frog.angle) * 35,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: dogDuration + Math.random() * 22,
      wag: Math.random() * Math.PI * 2,
      size: 0.78 + Math.random() * 0.4,
      color: ["#fbbf24", "#a8a29e", "#f97316", "#e5e7eb"][i % 4],
    });
  }
}

function draw() {
  drawBackground();
  drawFlies();
  drawFrog();
  drawDogs();
}

function drawBackground() {
  ctx.fillStyle = "#10261c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 72) {
    for (let x = 0; x < canvas.width; x += 72) {
      ctx.fillStyle = (x / 72 + y / 72) % 2 === 0 ? "#153424" : "#0f2a1d";
      ctx.fillRect(x, y, 72, 72);
    }
  }

  ctx.strokeStyle = "rgba(132, 204, 22, 0.22)";
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  for (let i = 0; i < 16; i += 1) {
    const x = (i * 89 + 35) % canvas.width;
    const y = (i * 157 + 62) % canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 20, y - 28, x + 46, y - 3);
    ctx.quadraticCurveTo(x + 16, y + 14, x, y);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(56, 189, 248, 0.2)";
  for (let i = 0; i < 10; i += 1) {
    const x = (i * 131 + 70) % canvas.width;
    const y = (i * 97 + 130) % canvas.height;
    ctx.beginPath();
    ctx.ellipse(x, y, 28 + (i % 3) * 8, 13, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFlies() {
  flies.forEach((fly) => {
    const wing = Math.sin(fly.buzz) * 5;

    ctx.save();
    ctx.translate(fly.x, fly.y);
    ctx.rotate(fly.angle);

    ctx.fillStyle = "rgba(191, 219, 254, 0.85)";
    ctx.beginPath();
    ctx.ellipse(-7, -11 - wing, 15, 8, -0.45, 0, Math.PI * 2);
    ctx.ellipse(-7, 11 + wing, 15, 8, 0.45, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = fly.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2);
    ctx.roundRect(13, -9, 14, 18, 7);
    ctx.fill();

    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-5, -9);
    ctx.lineTo(-14, -17);
    ctx.moveTo(-5, 9);
    ctx.lineTo(-14, 17);
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.arc(22, -4, 3, 0, Math.PI * 2);
    ctx.arc(22, 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawFrog() {
  const squash = 1 + Math.sin(frog.hop) * 0.04;

  ctx.save();
  ctx.translate(frog.x, frog.y);
  ctx.rotate(frog.angle);
  ctx.scale(1 / squash, squash);

  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.ellipse(-11, 0, 34, 26, 0, 0, Math.PI * 2);
  ctx.roundRect(11, -24, 35, 48, 18);
  ctx.fill();

  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(20, -21, 18, 0, Math.PI * 2);
  ctx.arc(20, 21, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#16a34a";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-32, -13);
  ctx.lineTo(-52, -28);
  ctx.moveTo(-32, 13);
  ctx.lineTo(-52, 28);
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.arc(22, -21, 8, 0, Math.PI * 2);
  ctx.arc(22, 21, 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(25, -21, 4, 0, Math.PI * 2);
  ctx.arc(25, 21, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#14532d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(35, -8);
  ctx.quadraticCurveTo(46, 0, 35, 8);
  ctx.stroke();
  ctx.restore();
}

function drawDogs() {
  dogs.forEach((dog) => {
    const fade = Math.max(0, Math.min(1, dog.life / 26));
    const angle = Math.atan2(dog.vy, dog.vx);
    const wag = Math.sin(dog.wag) * 8;

    ctx.save();
    ctx.translate(dog.x, dog.y);
    ctx.rotate(angle);
    ctx.scale(dog.size, dog.size);
    ctx.globalAlpha = fade;

    ctx.fillStyle = dog.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 19, 12, 0, 0, Math.PI * 2);
    ctx.roundRect(13, -13, 18, 23, 8);
    ctx.fill();

    ctx.strokeStyle = dog.color;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-17, 1);
    ctx.lineTo(-31, -11 + wag);
    ctx.stroke();

    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.ellipse(18, -11, 7, 12, 0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(27, -4, 2.5, 0, Math.PI * 2);
    ctx.arc(32, 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function steerTowardPointer(event) {
  event.preventDefault();

  if (event.pointerType === "touch" && touchPointerId !== event.pointerId) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const scale = canvas.width / rect.width;
  pointerPosition = {
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
  pointerPosition = null;
  statusEl.textContent = "Touch and hold where your frog should go.";
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

restartButton.addEventListener("click", resetGame);
canvas.addEventListener("pointerdown", startTouchControl);
canvas.addEventListener("pointermove", steerTowardPointer);
canvas.addEventListener("pointerup", stopTouchControl);
canvas.addEventListener("pointercancel", stopTouchControl);

resetGame();
