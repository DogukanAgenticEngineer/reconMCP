import type { ReactNode } from "react";

interface HighlighterProps {
  children: ReactNode;
  className?: string;
  color?: string;
}

export function Highlighter({ children, className, color }: HighlighterProps) {
  return (
    <span
      className={`highlight-text${className ? ` ${className}` : ""}`}
      style={color ? { "--highlight-color": color } as React.CSSProperties : undefined}
    >
      {children}
    </span>
  );
}
