import { useRef } from 'react';

// 패널 리사이즈 — 시작점 기반 (delta 누적 에러 없음)
export function usePanelResize(
  getSizes: () => number[],
  setSizes: (sizes: number[]) => void,
  leftIdx: number,
  rightIdx: number,
  containerRef: React.RefObject<HTMLElement | null>,
  minPx: number = 80,
) {
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startSizes = [...getSizes()];
    const container = containerRef.current;
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const newLeft = startSizes[leftIdx] + dx;
      const newRight = startSizes[rightIdx] - dx;
      if (newLeft >= minPx && newRight >= minPx) {
        const next = [...startSizes];
        next[leftIdx] = newLeft;
        next[rightIdx] = newRight;
        setSizes(next);
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return { onMouseDown };
}

// 높이 리사이즈 (Charty's Pick 등)
export function useHeightResize(
  getHeight: () => number,
  setHeight: (h: number) => void,
  min: number = 28,
  max: number = 200,
) {
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = getHeight();

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      const dy = ev.clientY - startY;
      setHeight(Math.max(min, Math.min(startH + dy, max)));
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return { onMouseDown };
}
