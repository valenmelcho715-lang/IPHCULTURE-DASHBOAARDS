import { useEffect, useRef } from 'react';

export default function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cursor = cursorRef.current;
    const glow = glowRef.current;
    if (!cursor || !glow) return;

    const onMove = (e: MouseEvent) => {
      cursor.style.transform = `translate(${e.clientX - 12}px, ${e.clientY - 12}px)`;
      glow.style.transform = `translate(${e.clientX - 40}px, ${e.clientY - 40}px)`;
    };

    const onDown = () => {
      cursor.style.transform += ' scale(0.9)';
    };
    const onUp = () => {
      cursor.style.transform = cursor.style.transform.replace(' scale(0.9)', '');
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <>
      <div
        ref={cursorRef}
        className="custom-cursor"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 24,
          height: 24,
          zIndex: 99999,
          pointerEvents: 'none',
          transition: 'transform 0.05s ease-out',
        }}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
          <rect x="4" y="1" width="16" height="22" rx="3" stroke="#00f0ff" strokeWidth="1.5" fill="rgba(0,240,255,0.1)" />
          <rect x="7" y="4" width="10" height="14" rx="1" stroke="#00f0ff" strokeWidth="0.5" fill="none" />
          <circle cx="12" cy="19.5" r="1.5" fill="#00f0ff" />
        </svg>
      </div>
      <div
        ref={glowRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,240,255,0.15) 0%, transparent 70%)',
          zIndex: 99998,
          pointerEvents: 'none',
          transition: 'transform 0.15s ease-out',
        }}
      />
    </>
  );
}
