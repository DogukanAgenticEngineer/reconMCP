import { LoaderCircle } from 'lucide-react';
import type { ReactElement } from 'react';

export function Spinner({ className = '' }: { className?: string }): ReactElement {
  return <LoaderCircle aria-hidden="true" className={`loading-spinner ${className}`} focusable="false" />;
}
