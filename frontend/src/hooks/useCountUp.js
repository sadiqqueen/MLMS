import { useEffect, useRef, useState } from 'react';

// Count-up from 0 → target with ease-out-cubic over `duration` ms (default 1200,
// matching the prototype). Honors prefers-reduced-motion by snapping to the final
// value. Pass { active:false } to defer the animation until a card is revealed.
//
//   const shown = useCountUp(1284);            // animates on mount
//   const shown = useCountUp(96, { active: inView });
//
// Returns a number; format at the call site with .toLocaleString().
const prefersReduced = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function useCountUp(target, { active = true, duration = 1200 } = {}) {
  const end = Number(target) || 0;
  const [val, setVal] = useState(() => (prefersReduced() ? end : 0));
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;
    if (prefersReduced()) { setVal(end); return undefined; }

    let startTs = null;
    const tick = (ts) => {
      if (startTs == null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out-cubic
      setVal(Math.round(end * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, active, duration]);

  return val;
}
