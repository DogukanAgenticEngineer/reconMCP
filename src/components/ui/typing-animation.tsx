import { useEffect, useRef, useState } from "react";

interface TypingAnimationProps {
  text: string;
  duration?: number;
  className?: string;
  onComplete?: () => void;
}

export function TypingAnimation({ text, duration = 50, className, onComplete }: TypingAnimationProps) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    // Reset when text changes
    indexRef.current = 0;
    setDisplayed("");
    setDone(false);

    const type = () => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current < text.length) {
        timerRef.current = setTimeout(type, duration);
      } else {
        setDone(true);
        onCompleteRef.current?.();
      }
    };

    if (text.length > 0) {
      timerRef.current = setTimeout(type, duration);
    } else {
      setDone(true);
    }

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [text, duration]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden="true">{displayed}</span>
      {!done && <span className="typing-cursor" aria-hidden="true" />}
    </span>
  );
}
