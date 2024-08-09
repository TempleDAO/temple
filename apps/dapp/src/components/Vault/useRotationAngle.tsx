import { useRef, useEffect, useState, RefObject } from 'react';
import { VaultPage } from './types';

const TIMING: Record<number, number> = {
  0: 400,
  1: 400,
  2: 700,
  3: 800,
  4: 900,
};

type HookReturnType = [number, number, number, RefObject<SVGAnimationElement>];

const getPageAngle = (page?: VaultPage, isMobile = false) => {
  switch (page) {
    case 'claim':
      return isMobile ? -10 : -72.5;
    case 'stake':
      return isMobile ? -5 : -36.25;
    case 'summary':
      return 0;
    case 'strategy':
      return isMobile ? 5 : 36.25;
    case 'timing':
      return isMobile ? 10 : 72.5;
    default:
      return 0;
  }
};

// used in the animation for the selector nub and glow
// when user clicks different vault nav buttons
export const useRotationAngle = (
  selected?: VaultPage,
  isMobile = false
): HookReturnType => {
  const ref = useRef<SVGAnimationElement>(null);
  const [prevSelected, setPrevSelected] = useState(selected);
  const initialPageAngle = getPageAngle(selected, isMobile);
  const [angle, setAngle] = useState(initialPageAngle);
  const [prevAngle, setPrevAngle] = useState(initialPageAngle);

  useEffect(() => {
    if (prevSelected === selected) {
      return;
    }

    setPrevAngle(angle);
    setPrevSelected(selected);

    const nextAngle = getPageAngle(selected, isMobile);
    setAngle(nextAngle);

    ref.current?.beginElement();
  }, [angle, selected, prevSelected]);

  const dist = Math.abs(prevAngle - angle) / 36.25;

  const duration = isMobile ? 300 : TIMING[dist];

  return [angle, prevAngle, duration, ref];
};
