import ImageMap from './ImageMap';

import libraryShelfImage from 'assets/images/nexus/Library_Shelves5.png';

// individual highlights
import highlightTopRight from 'assets/images/nexus/Library_Shelves_top_right.png';
import highlightTopLeft from 'assets/images/nexus/Library_Shelves_top_left.png';
import highlightMiddle from 'assets/images/nexus/Library_Shelves_middle.png';
import highlightBottomLeft from 'assets/images/nexus/Library_Shelves_bottom_left.png';
import highlightBottomMiddle from 'assets/images/nexus/Library_Shelves_bottom_center.png';
import highlightBottomRight from 'assets/images/nexus/Library_Shelves_bottom_right.png';

import { useEffect } from 'react';
import styled from 'styled-components';

const NexusLibrary = () => {
  // Top row left
  //clip-path: polygon(42.2% 2%, 44.9% 2.3%, 44.7% 30.5%, 42.2% 29.8%);
  const TOP_ROW_LEFT = ['42.2% 2%', '44.9% 2.3%', '44.7% 30.5%', '42.2% 29.8%'];

  // Top row right
  // clip-path: polygon(95.5% 0.3%, 97.5% 0%, 97.2% 29.8%, 95.2% 30.3%);
  const TOP_ROW_RIGHT = ['95.5% 0.3%', '97.5% 0%', '97.2% 29.8%', '95.2% 30.3%'];

  // Middle center
  // clip-path: polygon(53.3% 45.5%, 55.3% 42.5%, 63.1% 66.8%, 60.3% 69.3%);
  const MIDDLE_CENTER = ['53.3% 45.5%', '55.3% 42.5%', '63.1% 66.8%', '60.3% 69.3%'];

  // Bottom row left
  // clip-path: polygon(0.94% 71.48%, 3.44% 71.48%, 3.44% 93.7%, 0.94% 93.7%);
  const BOTTOM_ROW_LEFT = ['0.94% 71.48%', '3.44% 71.48%', '3.44% 93.7%', '0.94% 93.7%'];

  // Bottom row center
  // clip-path: polygon(30.31% 71.48%, 33.44% 71.48%, 33.44% 93.7%, 30.31% 93.7%);
  const BOTTOM_ROW_CENTER = ['30.31% 71.48%', '33.44% 71.48%', '33.44% 93.7%', '30.31% 93.7%'];

  // Bottom row right
  // clip-path: polygon(63.67% 71.48%, 65.94% 71.48%, 65.94% 93.7%, 63.67% 93.7%);
  const BOTTOM_ROW_RIGHT = ['63.67% 71.48%', '65.94% 71.48%', '65.94% 93.7%', '63.67% 93.7%'];

  const hotspots = [
    { points: TOP_ROW_LEFT },
    { points: TOP_ROW_RIGHT },
    { points: MIDDLE_CENTER },
    { points: BOTTOM_ROW_LEFT },
    { points: BOTTOM_ROW_CENTER },
    { points: BOTTOM_ROW_RIGHT },
  ];

  const imgHovers = [
    highlightTopLeft,
    highlightTopRight,
    highlightMiddle,
    highlightBottomLeft,
    highlightBottomMiddle,
    highlightBottomRight,
  ];

  function preloadImages(imageUrls: string[]) {
    return imageUrls.map((url) => {
      const img = new Image();
      img.src = url;
      return img;
    });
  }

  useEffect(() => {
    preloadImages(imgHovers);
  }, []);

  return (
    <LibraryContainer>
      <ImageMap imageSrc={libraryShelfImage} imageSrcHover={imgHovers} hotspots={hotspots} />
    </LibraryContainer>
  );
};

export default NexusLibrary;

const LibraryContainer = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;
