import { useState, useEffect, RefObject } from 'react';
import { Box } from './types';
import { useWindowResize } from './useWindowResize';


export function useContentBox(svgRef: RefObject<SVGGElement>) {
  const windowBox = useWindowResize();
  const [size, setSize] = useState<number>(); // h or w of SVG square
  const [box, setBox] = useState<Box>();

  // stringify otherwise the useEffect array don't work and it loops infinitely
  const string = JSON.stringify(box);

  useEffect(() => {
    // This positions and sizes a div perfectly against the
    // inner circle, allowing for the SVG to be resized at will
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;

    setSize(rect.height);
    const scaleFactor = rect.height / 1000;
    const b:Box = {
      left: rect.x + 240 * scaleFactor,
      top: rect.y + 240 * scaleFactor,
      width: 520 * scaleFactor,
      height: 520 * scaleFactor,
    };
    setBox(b);
  }, [string, windowBox, size]);

  return box;
}
