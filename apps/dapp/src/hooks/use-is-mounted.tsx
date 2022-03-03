import * as React from 'react';

const useIsMounted = () => {
  const isMountedRef = React.useRef(true);

  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, [isMountedRef]);

  return isMountedRef;
};

export default useIsMounted;
