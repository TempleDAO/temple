import React, { useEffect } from 'react';
import { Howl } from 'howler';

function useCancellableSoundscape(track: Howl) {
  // start looping on mount
  useEffect(() => {
    if (track.playing()) {
      return;
    }
    track.play();
  }, []);

  return () => track.stop();
}

export default useCancellableSoundscape;
