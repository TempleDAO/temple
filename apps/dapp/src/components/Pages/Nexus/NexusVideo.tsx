import { useEffect, useRef } from 'react';

type Callback = () => void;

export interface VideoPlaybackConfig {
  videoSrc: string;
  onPlaybackCompleteHandler: Callback;
}

export const NexusVideo = (props: { config: VideoPlaybackConfig }) => {
  const { config } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const handler = () => {
      config.onPlaybackCompleteHandler();
    };
    videoRef.current?.addEventListener('ended', handler, false);
    return () => {
      videoRef.current?.removeEventListener('ended', handler, false);
    };
  });
  return (
    <video controls={true} disablePictureInPicture autoPlay width={'100%'} ref={videoRef}>
      <source src={config.videoSrc} />
    </video>
  );
};
