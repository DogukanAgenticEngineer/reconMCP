import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";

/**
 * RainbowButton, adapted from Magic UI (MIT).
 * Source: https://magicui.design/docs/components/rainbow-button
 * The component keeps the upstream variant API while using this app's existing
 * cn/cva setup and native button semantics (no extra runtime dependency).
 */
const rainbowButtonVariants = cva(
  "relative isolate inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-medium outline-none transition-all focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "rounded-lg border-0",
        outline: "rounded-lg border border-input",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-11 rounded-xl px-8 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface RainbowButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof rainbowButtonVariants> {}

const RainbowButton = React.forwardRef<HTMLButtonElement, RainbowButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      data-slot="button"
      className={cn(rainbowButtonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);

RainbowButton.displayName = "RainbowButton";

// eslint-disable-next-line react-refresh/only-export-components
export { RainbowButton, rainbowButtonVariants };
