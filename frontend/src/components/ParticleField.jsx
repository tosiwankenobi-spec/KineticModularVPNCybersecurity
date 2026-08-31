import React, { useRef, useEffect } from "react";

// Lightweight interactive network-mesh canvas (no external libs).
export default function ParticleField({ density = 60, color = "0, 229, 153", className = "" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h, raf;
    const mouse = { x: -9999, y: -9999 };
    let nodes = [];

    const resize = () => {
      w = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      const count = Math.min(density, Math.floor((canvas.offsetWidth * canvas.offsetHeight) / 12000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4 * window.devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.4 * window.devicePixelRatio,
      }));
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * window.devicePixelRatio;
      mouse.y = (e.clientY - r.top) * window.devicePixelRatio;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const maxDist = 140 * window.devicePixelRatio;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        for (let j = i + 1; j < nodes.length; j++) {
          const m = nodes[j];
          const dx = n.x - m.x;
          const dy = n.y - m.y;
          const d = Math.hypot(dx, dy);
          if (d < maxDist) {
            ctx.strokeStyle = `rgba(${color}, ${0.12 * (1 - d / maxDist)})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }
        const dm = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        if (dm < maxDist * 1.4) {
          ctx.strokeStyle = `rgba(${color}, ${0.3 * (1 - dm / (maxDist * 1.4))})`;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(${color}, 0.6)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.4 * window.devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
    };
  }, [density, color]);

  return <canvas ref={canvasRef} className={className} style={{ width: "100%", height: "100%" }} />;
}
