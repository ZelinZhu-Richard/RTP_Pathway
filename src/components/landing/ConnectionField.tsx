"use client";

import { useEffect, useRef } from "react";

interface ConnectionFieldProps {
  className?: string;
}

interface FieldNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: number;
  phase: number;
}

const PALETTE = [
  [111, 213, 255],
  [159, 120, 255],
  [255, 178, 132],
] as const;

function createSeededRandom(seed: number) {
  let value = seed >>> 0;

  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * A lightweight, dependency-free connection field layered over the supplied
 * cosmic artwork. It reacts to the pointer, scales its density to the viewport,
 * and becomes a single static frame when reduced motion is requested.
 */
export function ConnectionField({ className = "" }: ConnectionFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    const experienceShell = canvas.closest<HTMLElement>(".public-experience-shell");
    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame: number | null = null;
    let nodes: FieldNode[] = [];
    let pointer = { x: -1000, y: -1000, active: false };
    const initialBounds = canvas.getBoundingClientRect();
    let isIntersecting =
      initialBounds.bottom >= 0 &&
      initialBounds.right >= 0 &&
      initialBounds.top <= window.innerHeight &&
      initialBounds.left <= window.innerWidth;
    let pageVisible = document.visibilityState === "visible";
    let observedScene: Element | null = null;

    const createNodes = () => {
      const area = width * height;
      const target = coarsePointer.matches ? area / 26_000 : area / 18_000;
      const count = Math.max(24, Math.min(coarsePointer.matches ? 44 : 72, Math.round(target)));
      const random = createSeededRandom(0x525450);
      nodes = Array.from({ length: count }, (_, index) => ({
        x: random() * width,
        y: height * (0.28 + random() * 0.68),
        vx: (random() - 0.5) * 0.12,
        vy: (random() - 0.5) * 0.08,
        radius: index % 11 === 0 ? 1.9 : 0.7 + random() * 0.9,
        color: index % PALETTE.length,
        phase: random() * Math.PI * 2,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      createNodes();
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isIntersecting || !pageVisible) return;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointer = {
        x,
        y,
        active: x >= 0 && x <= rect.width && y >= 0 && y <= rect.height,
      };
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";

      const connectionDistance = width < 640 ? 105 : 150;
      const pointerDistance = width < 640 ? 130 : 210;
      const moving = !reducedMotion.matches;

      for (const node of nodes) {
        if (moving) {
          node.vx += Math.sin(time * 0.00018 + node.phase) * 0.0007;
          node.vy += Math.cos(time * 0.00016 + node.phase) * 0.00055;

          if (pointer.active) {
            const dx = node.x - pointer.x;
            const dy = node.y - pointer.y;
            const distance = Math.hypot(dx, dy) || 1;
            if (distance < pointerDistance) {
              const influence = (1 - distance / pointerDistance) * 0.012;
              node.vx += (dx / distance) * influence;
              node.vy += (dy / distance) * influence;
            }
          }

          node.vx *= 0.994;
          node.vy *= 0.994;
          node.x += node.vx;
          node.y += node.vy;

          if (node.x < -20) node.x = width + 20;
          if (node.x > width + 20) node.x = -20;
          if (node.y < height * 0.22) node.y = height + 12;
          if (node.y > height + 20) node.y = height * 0.24;
        }
      }

      context.lineWidth = 0.7;
      for (let i = 0; i < nodes.length; i += 1) {
        const start = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const end = nodes[j];
          const distance = Math.hypot(start.x - end.x, start.y - end.y);
          if (distance >= connectionDistance) continue;
          const alpha = (1 - distance / connectionDistance) * 0.18;
          const color = PALETTE[(start.color + end.color) % PALETTE.length];
          context.strokeStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
          context.beginPath();
          context.moveTo(start.x, start.y);
          context.lineTo(end.x, end.y);
          context.stroke();
        }
      }

      for (const node of nodes) {
        const color = PALETTE[node.color];
        const pulse = moving ? 0.76 + Math.sin(time * 0.0012 + node.phase) * 0.24 : 0.9;
        const glow = context.createRadialGradient(
          node.x,
          node.y,
          0,
          node.x,
          node.y,
          node.radius * 8,
        );
        glow.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.8 * pulse})`);
        glow.addColorStop(0.2, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${0.32 * pulse})`);
        glow.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(node.x, node.y, node.radius * 8, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = `rgba(230, 244, 255, ${0.68 * pulse})`;
        context.beginPath();
        context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        context.fill();
      }

      context.restore();
    };

    const stop = () => {
      if (frame === null) return;
      window.cancelAnimationFrame(frame);
      frame = null;
    };

    const shouldAnimate = () =>
      isIntersecting && pageVisible && !reducedMotion.matches;

    const animate = (time: number) => {
      frame = null;
      if (!shouldAnimate()) return;
      draw(time);
      frame = window.requestAnimationFrame(animate);
    };

    const refreshPlayback = (redraw = false) => {
      stop();
      if (!isIntersecting || !pageVisible) return;

      if (redraw || reducedMotion.matches) draw(performance.now());
      if (!reducedMotion.matches) frame = window.requestAnimationFrame(animate);
    };

    const observer = new ResizeObserver(() => {
      resize();
      refreshPlayback(true);
    });

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isIntersecting = Boolean(entry?.isIntersecting);
        refreshPlayback(isIntersecting);
      },
      { rootMargin: "160px 0px" },
    );

    const bindSceneObserver = () => {
      const nextTarget =
        experienceShell?.querySelector<HTMLElement>("[data-ambient-render-sentinel]") ??
        canvas;
      if (nextTarget === observedScene) return;
      if (observedScene) visibilityObserver.unobserve(observedScene);
      observedScene = nextTarget;
      const bounds = nextTarget.getBoundingClientRect();
      isIntersecting =
        bounds.bottom >= -160 &&
        bounds.right >= 0 &&
        bounds.top <= window.innerHeight + 160 &&
        bounds.left <= window.innerWidth;
      visibilityObserver.observe(nextTarget);
      refreshPlayback(isIntersecting);
    };

    const sceneObserver = new MutationObserver(bindSceneObserver);

    const handleVisibilityChange = () => {
      pageVisible = document.visibilityState === "visible";
      refreshPlayback(pageVisible);
    };

    const handleMotionChange = () => refreshPlayback(true);

    const handleDensityChange = () => {
      resize();
      refreshPlayback(true);
    };

    observer.observe(canvas);
    if (experienceShell) {
      sceneObserver.observe(experienceShell, { childList: true, subtree: true });
    }
    bindSceneObserver();
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    reducedMotion.addEventListener("change", handleMotionChange);
    coarsePointer.addEventListener("change", handleDensityChange);
    resize();
    refreshPlayback(true);

    return () => {
      observer.disconnect();
      visibilityObserver.disconnect();
      sceneObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      reducedMotion.removeEventListener("change", handleMotionChange);
      coarsePointer.removeEventListener("change", handleDensityChange);
      stop();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
