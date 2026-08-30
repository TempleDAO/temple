import React, { useRef, useState, useEffect } from 'react';
import styled from 'styled-components';

interface Props {
  videoSrc: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onClick: () => void;
}

const SmartClickableVideo: React.FC<Props> = ({
  videoSrc,
  x,
  y,
  width,
  height,
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canClick, setCanClick] = useState(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

    // Convert mouseX/Y into canvas space
    const xCanvas = (mouseX / rect.width) * canvasWidth;
    const yCanvas = (mouseY / rect.height) * canvasHeight;

    const pixel = ctx.getImageData(xCanvas, yCanvas, 1, 1).data;
    const [r, g, b] = pixel;

    // If it's not solid black, allow click
    const brightness = r + g + b;
    const isVisible = brightness > 10;

    setCanClick(isVisible);
    (e.currentTarget as HTMLDivElement).style.cursor = isVisible
      ? 'pointer'
      : 'default';
  };

  const handleClick = () => {
    if (canClick) {
      onClick();
    }
  };

  return (
    <Wrapper
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
      }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    >
      <Video ref={videoRef} autoPlay muted loop playsInline preload="auto">
        <source src={videoSrc} type="video/webm" />
      </Video>
      <HiddenCanvas ref={canvasRef} width={256} height={256} />
    </Wrapper>
  );
};

export default SmartClickableVideo;

const Wrapper = styled.div`
  position: absolute;
  cursor: pointer;
  z-index: 2;
`;

const Video = styled.video.attrs({
  disablePictureInPicture: true,
})`
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
  display: block;
`;

const HiddenCanvas = styled.canvas`
  display: none;
`;
