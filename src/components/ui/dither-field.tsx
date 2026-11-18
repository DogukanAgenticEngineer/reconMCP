import { useEffect, useRef } from "react";

// Bayer 4x4 ordered dithering matrix (normalized 0–15)
const BAYER4 = [
   0,  8,  2, 10,
  12,  4, 14,  6,
   3, 11,  1,  9,
  15,  7, 13,  5,
];

interface DitherFieldProps {
  className?: string;
  isDark?: boolean;
}

export function DitherField({ className, isDark = false }: DitherFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 80;
    const H = 60;
    canvas.width = W;
    canvas.height = H;

    const imageData = ctx.createImageData(W, H);
    const data = imageData.data;

    // Colors: dark mode uses near-white grain, light uses near-black grain
    const grain = isDark ? 220 : 30;

    const draw = () => {
      tRef.current += 0.018;
      const t = tRef.current;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          // Animated noise: combine multiple sine waves for organic feel
          const nx = x / W;
          const ny = y / H;
          const noise =
            Math.sin(nx * 6.3 + t) * 0.25 +
            Math.sin(ny * 5.7 - t * 0.8) * 0.25 +
            Math.sin((nx + ny) * 4.1 + t * 1.3) * 0.25 +
            Math.sin((nx - ny) * 3.9 - t * 0.5) * 0.25;

          // Map noise from [-1,1] to [0,1]
          const value = (noise + 1) / 2;

          // Apply Bayer ordered dithering
          const bx = x % 4;
          const by = y % 4;
          const threshold = (BAYER4[by * 4 + bx]! + 0.5) / 16;
          const dithered = value > threshold ? 1 : 0;

          const idx = (y * W + x) * 4;
          const c = dithered ? grain : 0;
          data[idx] = c;
          data[idx + 1] = c;
          data[idx + 2] = c;
          data[idx + 3] = dithered ? 255 : 0;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      className={`dither-bg${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
