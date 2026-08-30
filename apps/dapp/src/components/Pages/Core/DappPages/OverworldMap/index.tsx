import SmartClickableVideo from './components/SmartClickableVideo';
import styled from 'styled-components';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

interface AnimatedSection {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  videoSrc: string;
  targetRoute: string;
  title: string;
}

const animatedSections: AnimatedSection[] = [
  {
    id: 'forge',
    x: 25.8,
    y: 43,
    width: 17.5,
    height: 21.3,
    videoSrc:
      '/src/components/Pages/Core/DappPages/OverworldMap/assets/animations/FORGE.webm',
    targetRoute: '/dapp/spice/overview',
    title: 'Forge',
  },
  {
    id: 'prayer-hall',
    x: 64,
    y: 5,
    width: 25.3,
    height: 38.1,
    videoSrc:
      '/src/components/Pages/Core/DappPages/OverworldMap/assets/animations/PRAYER HALL.webm',
    targetRoute: '/dapp/spice/overview',
    title: 'Prayer Hall',
  },
  {
    id: 'market',
    x: 47.6,
    y: 35,
    width: 20.9,
    height: 44.3,
    videoSrc:
      '/src/components/Pages/Core/DappPages/OverworldMap/assets/animations/MARKET.webm',
    targetRoute: '/dapp/spice/overview',
    title: 'Market',
  },
  {
    id: 'harbour',
    x: 22,
    y: 71,
    width: 18.6,
    height: 23.9,
    videoSrc:
      '/src/components/Pages/Core/DappPages/OverworldMap/assets/animations/HARBOUR.webm',
    targetRoute: '/dapp/spice/overview',
    title: 'Harbour',
  },
  {
    id: 'gallery',
    x: 64,
    y: 68,
    width: 22.4,
    height: 34.1,
    videoSrc:
      '/src/components/Pages/Core/DappPages/OverworldMap/assets/animations/GALLERY.webm',
    targetRoute: '/dapp/spice/overview',
    title: 'Gallery',
  },
  {
    id: 'atrium',
    x: 3.8,
    y: 2.8,
    width: 29.7,
    height: 47.0,
    videoSrc:
      '/src/components/Pages/Core/DappPages/OverworldMap/assets/animations/ATRIUM.webm',
    targetRoute: '/dapp/spice/overview',
    title: 'Atrium',
  },
  {
    id: 'library',
    x: 41.8,
    y: 21,
    width: 14.2,
    height: 27.2,
    videoSrc:
      '/src/components/Pages/Core/DappPages/OverworldMap/assets/animations/LIBRARY.webm',
    targetRoute: '/dapp/spice/overview',
    title: 'Library',
  },
];

const OverworldMap = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });

  const handleSectionClick = (section: AnimatedSection) => {
    window.location.href = section.targetRoute;
  };

  const getBackgroundImage = () =>
    '/src/components/Pages/Core/DappPages/OverworldMap/assets/backgrounds/temple-temp-background.png';

  if (!isPhoneOrAbove) {
    return (
      <MobileContainer>
        {animatedSections.map((section, index) => (
          <MobileSection key={section.id} isReversed={index % 2 === 1}>
            <MobileVideoContainer>
              <MobileVideoElement autoPlay muted loop playsInline>
                <source src={section.videoSrc} type="video/webm" />
              </MobileVideoElement>
            </MobileVideoContainer>
            <MobileTitleContainer>
              <MobileTitle>{section.title}</MobileTitle>
            </MobileTitleContainer>
          </MobileSection>
        ))}
      </MobileContainer>
    );
  }

  return (
    <MapContainer>
      {/* <BackgroundImage src={getBackgroundImage()} alt="Overworld Map" /> */}
      {animatedSections.map((section) => (
        <SmartClickableVideo
          key={section.id}
          videoSrc={section.videoSrc}
          x={section.x}
          y={section.y}
          width={section.width}
          height={section.height}
          onClick={() => handleSectionClick(section)}
        />
      ))}
    </MapContainer>
  );
};

export default OverworldMap;

const MapContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 1920px;
  aspect-ratio: 16 / 9;
  margin: 0 auto;
  background-color: grey;
  overflow: hidden;
`;

const BackgroundImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  z-index: 0;
`;

const AnimatedSectionWrapper = styled.div<{
  x: number;
  y: number;
  width: number;
  height: number;
}>`
  position: absolute;
  left: ${(props) => props.x}%;
  top: ${(props) => props.y}%;
  width: ${(props) => props.width}%;
  height: ${(props) => props.height}%;
  cursor: pointer;
  background: transparent;
  z-index: 1;
`;

const VideoElement = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: transparent;
  display: block;
  // opacity: 0.5;
  z-index: 2;
  pointer-events: none; /* Make overlay transparent to clicks */
`;

const MobileContainer = styled.div`
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const MobileSection = styled.div<{ isReversed: boolean }>`
  display: flex;
  flex-direction: ${(props) => (props.isReversed ? 'row-reverse' : 'row')};
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  min-height: 120px;
`;

const MobileVideoContainer = styled.div`
  width: 50%;
  height: 120px;
  overflow: hidden;
`;

const MobileVideoElement = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: transparent;
  display: block;
`;

const MobileTitleContainer = styled.div`
  width: 50%;
  padding: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const MobileTitle = styled.h3`
  margin: 0;
  color: white;
  font-size: 1.2rem;
  text-align: center;
  font-weight: 600;
`;
