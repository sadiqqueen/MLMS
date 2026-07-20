import { useEffect, useRef, useState } from 'react';

// Scroll-reveal wrapper for the mt- dashboards/lists. Starts hidden
// (opacity:0 + translateY via .mt-reveal) and adds .is-in when the element
// enters the viewport (IntersectionObserver, threshold 0.08). A 1400ms fallback
// forces visibility so nothing ever stays hidden. prefers-reduced-motion →
// visible immediately (the global reduced-motion block also zeroes the
// transition, so it snaps).
//
//   <RevealOnScroll delay={i * 0.055}> <StatCard .../> </RevealOnScroll>
//   <RevealOnScroll as="section" chart delay={0.08}> <ChartCard/> </RevealOnScroll>
export default function RevealOnScroll({
  as: Tag = 'div',
  className = '',
  delay = 0,
  chart = false,
  style,
  children,
  ...props
}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    let done = false;
    const reveal = () => { if (!done) { done = true; setInView(true); } };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { reveal(); io.disconnect(); }
      });
    }, { threshold: 0.08 });
    io.observe(el);

    const fallback = setTimeout(reveal, 1400);
    return () => { io.disconnect(); clearTimeout(fallback); };
  }, []);

  const cls = ['mt-reveal', chart ? 'mt-reveal--chart' : '', inView ? 'is-in' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      ref={ref}
      className={cls}
      style={{ transitionDelay: delay ? `${delay}s` : undefined, ...style }}
      {...props}
    >
      {children}
    </Tag>
  );
}
