import { Progress as ProgressPrimitive } from '@base-ui/react/progress';
import type { ComponentProps } from 'react';
import { cn } from 'cn';

function Progress({ className, value, ...props }: ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      className={cn('progress-root', className)}
      data-slot="progress"
      value={value}
      {...props}
    >
      <ProgressPrimitive.Track className="progress-track" data-slot="progress-track">
        <ProgressPrimitive.Indicator className="progress-indicator" data-slot="progress-indicator" />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
