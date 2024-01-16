import lottie from 'lottie-web';
import { useEffect, useRef } from 'react';

interface LottieProps {
  animationData: any;
  width: number;
  height: number;
}

export const Lottie = ({ animationData, width, height }: LottieProps) => {
  const element = useRef<HTMLDivElement>(null);
  const lottieInstance = useRef<any>();

  useEffect(() => {
    if (element.current) {
      lottieInstance.current = lottie.loadAnimation({
        animationData,
        container: element.current,
      });
    }
  }, [animationData]);

  return <div style={{ width, height }} ref={element}></div>;
};
