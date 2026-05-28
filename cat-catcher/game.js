const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const scoreEl = document.querySelector("#score");
const statusEl = document.querySelector("#status");
const restartButton = document.querySelector("#restart");

const mouseCount = 4;
const birdCount = 2;
const catSpeed = 4.2;
const mouseSpeed = 1.45;
const birdSpeed = 2.2;
const catchDistance = 46;
const gooseDuration = 70;

let cat;
let mice;
let birds;
let geese;
let score;
let pointerPosition;
let touchPointerId;
let animationId;

function resetGame() {
  cat = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    angle: 0,
  };
  mice = [];
  birds = [];
  geese = [];
  score = 0;
  pointerPosition = null;
  touchPointerId = null;
  scoreEl.textContent = score;
  statusEl.textContent = "Touch and hold where your cat should go.";
  placeMice();
  placeBirds();
  startAnimation();
}

function placeMice() {
  while (mice.length < mouseCount) {
    mice.push(createMouse());
  }
}

function createMouse() {
  const edge = Math.floor(Math.random() * 4);
  const padding = 70;
  const mouse = {
    x: padding + Math.random() * (canvas.width - padding * 2),
    y: padding + Math.random() * (canvas.height - padding * 2),
    angle: Math.random() * Math.PI * 2,
    turnTimer: 20 + Math.random() * 50,
    color: ["#cbd5e1", "#a8a29e", "#d6d3d1", "#94a3b8"][mice.length % 4],
  };

  if (edge === 0) mouse.y = padding;
  if (edge === 1) mouse.x = canvas.width - padding;
  if (edge === 2) mouse.y = canvas.height - padding;
  if (edge === 3) mouse.x = padding;
  return mouse;
}

function placeBirds() {
  while (birds.length < birdCount) {
    birds.push(createBird());
  }
}

function createBird() {
  const padding = 80;
  return {
    x: padding + Math.random() * (canvas.width - padding * 2),
    y: padding + Math.random() * (canvas.height - padding * 2),
    angle: Math.random() * Math.PI * 2,
    turnTimer: 18 + Math.random() * 45,
    flap: Math.random() * Math.PI * 2,
    color: ["#60a5fa", "#fbbf24", "#f472b6", "#5eead4"][birds.length % 4],
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
  updateCat();
  updateMice();
  updateBirds();
  updateGeese();
  checkCatches();
}

function updateCat() {
  if (!pointerPosition) return;

  const deltaX = pointerPosition.x - cat.x;
  const deltaY = pointerPosition.y - cat.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance < 5) return;

  cat.angle = Math.atan2(deltaY, deltaX);
  const step = Math.min(catSpeed, distance);
  cat.x += (deltaX / distance) * step;
  cat.y += (deltaY / distance) * step;
}

function updateMice() {
  mice.forEach((mouse) => {
    mouse.turnTimer -= 1;
    if (mouse.turnTimer <= 0) {
      mouse.angle = roamingAngle(mouse, 95, 1.7);
      mouse.turnTimer = 24 + Math.random() * 55;
    }

    mouse.x += Math.cos(mouse.angle) * mouseSpeed;
    mouse.y += Math.sin(mouse.angle) * mouseSpeed;

    if (mouse.x < 32 || mouse.x > canvas.width - 32) {
      mouse.angle = Math.PI - mouse.angle;
    }
    if (mouse.y < 32 || mouse.y > canvas.height - 32) {
      mouse.angle = -mouse.angle;
    }

    mouse.x = clamp(mouse.x, 32, canvas.width - 32);
    mouse.y = clamp(mouse.y, 32, canvas.height - 32);
  });
}

function updateBirds() {
  birds.forEach((bird) => {
    bird.turnTimer -= 1;
    if (bird.turnTimer <= 0) {
      bird.angle = roamingAngle(bird, 115, 2.3);
      bird.turnTimer = 18 + Math.random() * 42;
    }

    bird.x += Math.cos(bird.angle) * birdSpeed;
    bird.y += Math.sin(bird.angle) * birdSpeed;
    bird.flap += 0.35;

    if (bird.x < 38 || bird.x > canvas.width - 38) {
      bird.angle = Math.PI - bird.angle;
    }
    if (bird.y < 38 || bird.y > canvas.height - 38) {
      bird.angle = -bird.angle;
    }

    bird.x = clamp(bird.x, 38, canvas.width - 38);
    bird.y = clamp(bird.y, 38, canvas.height - 38);
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

  const awayFromCat = Math.atan2(creature.y - cat.y, creature.x - cat.x);
  const randomWander = creature.angle + (Math.random() - 0.5) * wanderAmount;
  const catDistance = Math.hypot(creature.x - cat.x, creature.y - cat.y);

  if (catDistance < 150) {
    return awayFromCat * 0.65 + randomWander * 0.35;
  }

  return randomWander;
}

function updateGeese() {
  geese = geese
    .map((goose) => ({
      ...goose,
      x: goose.x + goose.vx,
      y: goose.y + goose.vy,
      vx: goose.vx * 0.986,
      vy: goose.vy * 0.986,
      flap: goose.flap + 0.42,
      life: goose.life - 1,
    }))
    .filter((goose) => goose.life > 0);
}

function checkCatches() {
  for (let i = mice.length - 1; i >= 0; i -= 1) {
    const mouse = mice[i];
    const distance = Math.hypot(mouse.x - cat.x, mouse.y - cat.y);

    if (distance <= catchDistance) {
      mice.splice(i, 1);
      score += 1;
      scoreEl.textContent = score;
      statusEl.textContent = "Toot geese!";
      spawnGeese();
      mice.push(createMouse());
    }
  }

  for (let i = birds.length - 1; i >= 0; i -= 1) {
    const bird = birds[i];
    const distance = Math.hypot(bird.x - cat.x, bird.y - cat.y);

    if (distance <= catchDistance) {
      birds.splice(i, 1);
      score += 1;
      scoreEl.textContent = score;
      statusEl.textContent = "Toot geese!";
      spawnGeese();
      birds.push(createBird());
    }
  }
}

function spawnGeese() {
  for (let i = 0; i < 8; i += 1) {
    const angle = cat.angle + (Math.random() - 0.5) * 1.7;
    const speed = 3 + Math.random() * 4.5;
    geese.push({
      x: cat.x + Math.cos(cat.angle) * 28,
      y: cat.y + Math.sin(cat.angle) * 28,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: gooseDuration + Math.random() * 24,
      flap: Math.random() * Math.PI * 2,
      size: 0.8 + Math.random() * 0.45,
    });
  }
}

function draw() {
  drawBackground();
  drawMice();
  drawBirds();
  drawCat();
  drawGeese();
}

function drawBackground() {
  ctx.fillStyle = "#2d2430";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < canvas.height; y += 72) {
    for (let x = 0; x < canvas.width; x += 72) {
      ctx.fillStyle = (x / 72 + y / 72) % 2 === 0 ? "#332737" : "#2a2230";
      ctx.fillRect(x, y, 72, 72);
    }
  }

  ctx.fillStyle = "rgba(251, 191, 36, 0.22)";
  for (let i = 0; i < 22; i += 1) {
    const x = (i * 97 + 40) % canvas.width;
    const y = (i * 151 + 88) % canvas.height;
    ctx.beginPath();
    ctx.arc(x, y, 5 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(251, 207, 232, 0.18)";
  ctx.lineWidth = 5;
  for (let i = 0; i < 10; i += 1) {
    const x = (i * 137 + 30) % canvas.width;
    const y = (i * 83 + 50) % canvas.height;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 28, y + 18);
    ctx.lineTo(x + 45, y - 6);
    ctx.stroke();
  }
}

function drawMice() {
  mice.forEach((mouse) => {
    ctx.save();
    ctx.translate(mouse.x, mouse.y);
    ctx.rotate(mouse.angle);

    ctx.strokeStyle = "#71717a";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-22, 8);
    ctx.quadraticCurveTo(-47, 11, -57, 32);
    ctx.stroke();

    ctx.fillStyle = mouse.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 21, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(22, -13, 11, 0, Math.PI * 2);
    ctx.arc(22, 13, 11, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fda4af";
    ctx.beginPath();
    ctx.arc(31, 0, 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(13, -7, 3, 0, Math.PI * 2);
    ctx.arc(13, 7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawBirds() {
  birds.forEach((bird) => {
    const wing = Math.sin(bird.flap) * 10;

    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(bird.angle);

    ctx.fillStyle = bird.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 18, 0, 0, Math.PI * 2);
    ctx.roundRect(17, -12, 20, 24, 10);
    ctx.fill();

    ctx.strokeStyle = bird.color;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-4, -5);
    ctx.lineTo(-29, -21 - wing);
    ctx.moveTo(-4, 5);
    ctx.lineTo(-29, 21 + wing);
    ctx.stroke();

    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(35, -6);
    ctx.lineTo(48, 0);
    ctx.lineTo(35, 6);
    ctx.fill();

    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.arc(27, -5, 2.5, 0, Math.PI * 2);
    ctx.arc(27, 5, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawCat() {
  ctx.save();
  ctx.translate(cat.x, cat.y);
  ctx.rotate(cat.angle);

  ctx.fillStyle = "#f9a8d4";
  ctx.beginPath();
  ctx.ellipse(-5, 0, 27, 20, 0, 0, Math.PI * 2);
  ctx.roundRect(10, -17, 30, 34, 13);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(14, -16);
  ctx.lineTo(20, -35);
  ctx.lineTo(27, -16);
  ctx.moveTo(31, -16);
  ctx.lineTo(38, -35);
  ctx.lineTo(41, -12);
  ctx.fill();

  ctx.strokeStyle = "#f9a8d4";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-28, 4);
  ctx.quadraticCurveTo(-52, -6, -38, -28);
  ctx.stroke();

  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(25, -6, 2.5, 0, Math.PI * 2);
  ctx.arc(25, 6, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(33, 0);
  ctx.lineTo(43, -7);
  ctx.moveTo(33, 0);
  ctx.lineTo(43, 7);
  ctx.stroke();
  ctx.restore();
}

function drawGeese() {
  geese.forEach((goose) => {
    const fade = Math.max(0, Math.min(1, goose.life / 26));
    const angle = Math.atan2(goose.vy, goose.vx);
    const wing = Math.sin(goose.flap) * 7;

    ctx.save();
    ctx.translate(goose.x, goose.y);
    ctx.rotate(angle);
    ctx.scale(goose.size, goose.size);
    ctx.globalAlpha = fade;

    ctx.fillStyle = "#f8fafc";
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
    ctx.roundRect(8, -14, 13, 12, 6);
    ctx.fill();

    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(-20, -13 - wing);
    ctx.moveTo(-4, 4);
    ctx.lineTo(-20, 13 + wing);
    ctx.stroke();

    ctx.fillStyle = "#f97316";
    ctx.beginPath();
    ctx.moveTo(21, -8);
    ctx.lineTo(31, -4);
    ctx.lineTo(21, 0);
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
  statusEl.textContent = "Touch and hold where your cat should go.";
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
