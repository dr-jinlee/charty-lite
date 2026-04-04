import { useCallback, useRef } from 'react';

export function useDragResize(
  direction: 'horizontal' | 'vertical',
  onDelta: (delta: number) => void,
) {
  const lastPos = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    function onMove(ev: PointerEvent) {
      const pos = direction === 'horizontal' ? ev.clientX : ev.clientY;
      const delta = pos - lastPos.current;
      lastPos.current = pos;
      if (delta !== 0) onDelta(delta);
    }

    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [direction, onDelta]);

  return { onPointerDown };
}
