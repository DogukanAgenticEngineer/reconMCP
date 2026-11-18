import { useEffect, useRef } from "react";

// Bayer 4x4 ordered dithering matrix (normalized 0–15)
const BAYER4 = [
   0,  8,  2, 10,
  12,  4, 14,  6,
   3, 11,  1,  9,
  15,  7, 13,  5,
];

type DitherPattern = "organic" | "horizon";

interface DitherFieldProps {
  className?: string;
  isDark?: boolean;
  pattern?: DitherPattern;
  color?: [string, string, string];
}

const DEFAULT_LIGHT_COLORS: [string, string, string] = ["#e0f7ff", "#7dd3fc", "#0e7490"];
const DEFAULT_DARK_COLORS: [string, string, string] = ["#082f49", "#38bdf8", "#dff6ff"];

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized;
  const parsed = Number.parseInt(value, 16);
  return [(parsed >> 16) & 255, (parsed >> 8) & 255, parsed & 255];
}

export function DitherField({
  className,
  isDark = false,
  pattern = "organic",
  color,
}: DitherFieldProps) {
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
    const palette = (color ?? (isDark ? DEFAULT_DARK_COLORS : DEFAULT_LIGHT_COLORS)).map(hexToRgb);

    const draw = () => {
      tRef.current += 0.018;
      const t = tRef.current;

      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const nx = x / W;
          const ny = y / H;
          const noise = pattern === "horizon"
            ? Math.sin(ny * 10.5 - t * 0.7) * 0.42
              + Math.sin(nx * 3.2 + t * 0.35) * 0.18
              + Math.sin((nx + ny) * 5.2 + t) * 0.16
              + Math.sin((nx - ny) * 3.4 - t * 0.45) * 0.12
            : Math.sin(nx * 6.3 + t) * 0.25
              + Math.sin(ny * 5.7 - t * 0.8) * 0.25
              + Math.sin((nx + ny) * 4.1 + t * 1.3) * 0.25
              + Math.sin((nx - ny) * 3.9 - t * 0.5) * 0.25;

          const value = Math.min(0.999, Math.max(0, (noise + 1) / 2));
          const bx = x % 4;
          const by = y % 4;
          const threshold = (BAYER4[by * 4 + bx]! + 0.5) / 16;
          const dithered = value > threshold;
          const idx = (y * W + x) * 4;

          if (!dithered) {
            data[idx + 3] = 0;
            continue;
          }

          const shade = value > 0.68 ? palette[2]! : value > 0.36 ? palette[1]! : palette[0]!;
          data[idx] = shade[0];
          data[idx + 1] = shade[1];
          data[idx + 2] = shade[2];
          data[idx + 3] = isDark ? 210 : 190;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [color, isDark, pattern]);

  return (
    <canvas
      ref={canvasRef}
      className={`dither-bg${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      style={{ imageRendering: "pixelated" }}
    />
  );
}
