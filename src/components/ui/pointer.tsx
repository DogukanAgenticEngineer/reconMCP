"use client";
import { useEffect, useRef } from "react";

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

interface PointerProps {
  className?: string;
  color?: string;
}

export function Pointer({ className, color = "hsl(219 85% 50%)" }: PointerProps) {
  const dotRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: -100, y: -100 });
  const visibleRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const dot = dotRef.current;
    if (!dot) return;

    const onMove = (e: MouseEvent) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (!visibleRef.current) {
        visibleRef.current = true;
        dot.style.opacity = "1";
      }
    };

    const onLeave = () => {
      visibleRef.current = false;
      if (dot) dot.style.opacity = "0";
    };

    const tick = () => {
      if (dot) {
        dot.style.transform = `translate(${posRef.current.x - 6}px, ${posRef.current.y - 6}px)`;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseleave", onLeave);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseleave", onLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={dotRef}
      className={cn("pointer-dot", className)}
      aria-hidden="true"
      style={{
        background: `radial-gradient(circle at 30% 30%, ${color}, hsl(264 62% 53%))`,
        opacity: 0,
      }}
    />
  );
}
