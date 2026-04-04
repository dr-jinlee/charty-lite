import { useCallback, useRef } from 'react';

// 드래그 리사이즈 훅
// setPointerCapture + native addEventListener로 부드러운 드래그
export function useDragResize(
  direction: 'horizontal' | 'vertical',
  onDelta: (delta: number) => void,
) {
  const lastPos = useRef(0);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    el.setPointerCapture(e.pointerId);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: PointerEvent) => {
      const pos = direction === 'horizontal' ? ev.clientX : ev.clientY;
      const delta = pos - lastPos.current;
      lastPos.current = pos;
      if (delta !== 0) onDelta(delta);
    };

    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('lostpointercapture', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('lostpointercapture', onUp);
  }, [direction, onDelta]);

  return { onPointerDown };
}
