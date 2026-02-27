export function createAnalogClock(canvas) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.42;

  function drawFace(accent, accent2) {
    ctx.clearRect(0, 0, w, h);

    // Outer glow
    const g = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, radius * 1.2);
    g.addColorStop(0, hexToRgba(accent, 0.18));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.25, 0, Math.PI * 2);
    ctx.fill();

    // Dial
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ticks
    for (let i = 0; i < 60; i++) {
      const ang = (i * Math.PI) / 30;
      const inner = radius * (i % 5 === 0 ? 0.84 : 0.90);
      const outer = radius * 0.96;

      ctx.strokeStyle = i % 5 === 0 ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.12)";
      ctx.lineWidth = i % 5 === 0 ? 2 : 1;

      ctx.beginPath();
      ctx.moveTo(cx + inner * Math.sin(ang), cy - inner * Math.cos(ang));
      ctx.lineTo(cx + outer * Math.sin(ang), cy - outer * Math.cos(ang));
      ctx.stroke();
    }

    // Center dot
    ctx.fillStyle = hexToRgba(accent2, 0.85);
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHands(hour, minute, second, accent, accent2) {
    const secAng = (second * Math.PI) / 30;
    const minAng = ((minute + second / 60) * Math.PI) / 30;
    const hourAng = (((hour % 12) + minute / 60) * Math.PI) / 6;

    // Hour
    drawHand(hourAng, radius * 0.52, 6, "rgba(255,255,255,0.85)");
    // Minute
    drawHand(minAng, radius * 0.72, 4, "rgba(255,255,255,0.85)");
    // Second
    drawHand(secAng, radius * 0.80, 2, hexToRgba(accent, 0.9));

    // Second hand tip
    ctx.fillStyle = hexToRgba(accent, 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy - radius * 0.80, 2.5, 0, Math.PI * 2);
    ctx.fill();

    function drawHand(angle, length, width, color) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.lineTo(0, -length);
      ctx.stroke();
      ctx.restore();
    }
  }

  let currentAccent = "#7dd3fc";
  let currentAccent2 = "#a78bfa";

  function render(t) {
    drawFace(currentAccent, currentAccent2);
    drawHands(t.hour, t.minute, t.second, currentAccent, currentAccent2);
  }

  function setThemeColors(accent, accent2) {
    if (accent) currentAccent = accent;
    if (accent2) currentAccent2 = accent2;
  }

  return { render, setThemeColors };
}

function hexToRgba(hex, a) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(125,211,252,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}