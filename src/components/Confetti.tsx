import { useEffect, useRef } from "react";

type Props = { active: boolean; durationMs?: number };

// Muted-palette confetti: a brief, quiet drift rather than a celebration siren.
export function Confetti({ active, durationMs = 3200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const colors = ["#BC6C4A", "#7E8E6B", "#5C6480", "#CBA45E", "#E9E2D4"];
    const W = () => window.innerWidth;
    const H = () => window.innerHeight;
    const parts = Array.from({ length: 110 }, () => ({
      x: Math.random() * W(),
      y: -20 - Math.random() * H() * 0.5,
      vx: (Math.random() - 0.5) * 2.5,
      vy: 1.5 + Math.random() * 3,
      r: 3 + Math.random() * 4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.15,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));

    const start = performance.now();
    const tick = (t: number) => {
      const elapsed = t - start;
      ctx.clearRect(0, 0, W(), H());
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - elapsed / durationMs);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r, -p.r * 0.4, p.r * 2, p.r * 0.8);
        ctx.restore();
      }
      if (elapsed < durationMs) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W(), H());
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      ctx.clearRect(0, 0, W(), H());
    };
  }, [active, durationMs]);

  if (!active) return null;
  return (
    <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" aria-hidden />
  );
}
