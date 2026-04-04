import { useCallback, useRef } from 'react';

// 드래그 리사이즈 훅 (가로/세로 공용)
export function useDragResize(
  direction: 'horizontal' | 'vertical',
  onDelta: (delta: number) => void,
) {
  const dragging = useRef(false);
  const lastPos = useRef(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const pos = direction === 'horizontal' ? e.clientX : e.clientY;
    const delta = pos - lastPos.current;
    lastPos.current = pos;
    if (delta !== 0) onDelta(delta);
  }, [direction, onDelta]);

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
  };
}
