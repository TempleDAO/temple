import { useEffect, MutableRefObject } from 'react';

// Detected when a click is made outside some element
// used to close popups
export function useOutsideClick(
  ref: MutableRefObject<any>,
  handler: () => void
) {
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target)) {
        handler();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref]);
}
