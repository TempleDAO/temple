import React, { useEffect } from 'react';
import { Howl } from 'howler';

function useUnmountableTrack(track: Howl) {
  // start looping on mount
  useEffect(() => {
    track.play();

    return () => {
      track.stop();
    };
  }, []);
}

export default useUnmountableTrack;
