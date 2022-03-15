import { useRef, useEffect, useState } from 'react';

// used in the animation for the selector nub and glow
// when user clicks different vault nav buttons
export const useRotationAngle = (selected: number) => {
  const ref = useRef<SVGElement>(null);
  const [prevSelected, setPrevSelected] = useState(selected);
  const [angle, setAngle] = useState(0);
  const [prevAngle, setPrevAngle] = useState(0);

  useEffect(() => {
    if (prevSelected == selected) return;
    setPrevAngle(angle);
    setPrevSelected(selected);
    switch (selected) {
      case 1:
        setAngle(-72.5);
        break;
      case 2:
        setAngle(-36.25);
        break;
      case 3:
        setAngle(0);
        break;
      case 4:
        setAngle(36.25);
        break;
      case 5:
        setAngle(72.5);
        break;
    }
    // @ts-ignore
    ref.current?.beginElement();
  }, [angle, selected, prevSelected]);

  const dist:number = (Math.abs(prevAngle - angle) / 36.25)
  const timing:Record<number, number> = {
    1: 400,
    2: 700,
    3: 800,
    4: 900
  }
  const duration = timing[dist]

  return [angle, prevAngle, duration, ref];
};
