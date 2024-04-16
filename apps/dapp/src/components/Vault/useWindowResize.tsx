// Credit https://gist.github.com/nslocum/f147149a243069577a91f5e1beaa5776

import { useEffect, useState } from 'react';
import throttle from 'lodash/throttle';

export function useWindowResize(delay = 200) {
  const [width, setWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    const debouncedHandleResize = throttle(handleResize, delay);
    window.addEventListener('resize', debouncedHandleResize);
    return () => {
      window.removeEventListener('resize', debouncedHandleResize);
    };
  }, [delay]);

  return width;
}
