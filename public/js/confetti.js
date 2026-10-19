// A short confetti burst on a canvas overlay. Seeded so a replay looks identical.

function seeded(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createConfetti(canvas) {
  const context = canvas.getContext("2d");
  let frame = null;

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }

  function stop() {
    if (frame) {
      cancelAnimationFrame(frame);
      frame = null;
    }

    context?.clearRect(0, 0, canvas.width, canvas.height);
  }

  return {
    burst({ colors = ["#f6c55b", "#ffffff", "#39e0c8"], seed = 1, originX = 0.5 } = {}) {
      if (!context || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      stop();
      const random = seeded(seed);
      const { width, height } = resize();
      const pieces = Array.from({ length: 170 }, () => ({
        x: width * originX + (random() - 0.5) * width * 0.3,
        y: height * 0.45,
        vx: (random() - 0.5) * 13,
        vy: -6 - random() * 11,
        size: 5 + random() * 7,
        rotation: random() * Math.PI,
        spin: (random() - 0.5) * 0.35,
        color: colors[Math.floor(random() * colors.length)],
        shape: random() > 0.5 ? "rect" : "circle",
      }));
      const startedAt = performance.now();

      const draw = (now) => {
        const age = now - startedAt;
        context.clearRect(0, 0, width, height);

        for (const piece of pieces) {
          piece.vy += 0.32;
          piece.vx *= 0.99;
          piece.x += piece.vx;
          piece.y += piece.vy;
          piece.rotation += piece.spin;
          context.save();
          context.globalAlpha = Math.max(0, 1 - age / 3400);
          context.translate(piece.x, piece.y);
          context.rotate(piece.rotation);
          context.fillStyle = piece.color;

          if (piece.shape === "rect") {
            context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
          } else {
            context.beginPath();
            context.arc(0, 0, piece.size / 3, 0, Math.PI * 2);
            context.fill();
          }

          context.restore();
        }

        frame = age < 3400 ? requestAnimationFrame(draw) : (stop(), null);
      };

      frame = requestAnimationFrame(draw);
    },
    stop,
  };
}
