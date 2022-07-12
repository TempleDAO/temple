import buildings from 'assets/images/roadmap-buildings.png';
import clouds from 'assets/images/roadmap-clouds.png';
import { useState } from 'react';
import styled from 'styled-components';
import { BgDimension, getBgImgDimensions } from 'utils/imageSize';

const items = [
  {
    title: 'Fire Ritual',
    description:
      'The First Temple Ritual known as the Fire Ritual, was a place where worthy Templars were given the right to early allocations of TEMPLE after burning their Incense.',
    icon: 'I',
    bottom: 0.26,
    left: 0.09,
  },
  {
    title: 'Enclave Organization',
    description:
      'TempleDAO organised itself into 5 Enclaves, designed in a way to thrive amongst specific talents of Templars. Templars were given the choice to join one of these enclaves. This structure made the process of finding talented Templars much more efficient.',
    icon: 'II',
    bottom: 0.16,
    left: 0.27,
  },
  {
    title: 'Opening Ceremony',
    description:
      'The Opening Ceremony (OC) allowed anyone to become a Templar by completing puzzles, collecting incense and sacrificing FRAX for $TEMPLE. Through this process TempleDAO raised almost $180M in FRAX — one of the largest initial fund raises for any DAO without traditional financing.',
    icon: 'III',
    bottom: 0.27,
    left: 0.38,
  },
  {
    title: 'AMM Launch',
    description:
      'The custom AMM allowed TempleDAO’s unique mechanisms to come into play, like Temple Defend and Exit Queue. Unfortunately, certain unforeseen factors during the exit queue created undue selling pressure on Temple. The team has rectified this issue and since then we are moving on full steam ahead!',
    icon: 'IV',
    bottom: 0.37,
    left: 0.2,
  },
  {
    title: 'Fifth Item',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    icon: 'V',
    bottom: 0.4,
    left: 0.63,
  },
  {
    title: 'Sixth Item',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    icon: 'VI',
    bottom: 0.64,
    left: 0.17,
  },
  {
    title: 'Seventh Item',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    icon: 'VII',
    bottom: 0.54,
    left: 0.84,
  },
  {
    title: 'Eighth Item',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    icon: 'VIII',
    bottom: 0.63,
    left: 0.45,
  },
  {
    title: 'Ninth Item',
    description: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
    icon: 'IX',
    bottom: 0.92,
    left: 0.72,
  },
];

const Roadmap = () => {
  // Used to determine background image size and position
  const [bgDimensions, setBgDimensions] = useState<BgDimension>();

  // Update bgDimensions state on image load and window resize
  function handleResize(image: HTMLImageElement) {
    const backgroundDimensions = getBgImgDimensions(image, image.src);
    if (!backgroundDimensions) return;
    setBgDimensions(backgroundDimensions);
  }

  return (
    <Container>
      <LeftBlur />
      <RightBlur />
      <Clouds src={clouds} />
      <ScrollableContainer>
        <Building
          src={buildings}
          onLoad={(e) => {
            const el = e.currentTarget;
            window.onresize = () => handleResize(el);
            handleResize(el);
          }}
        />
        {bgDimensions != null &&
          items.map((item, i) => (
            <Item
              key={i}
              onClick={() => console.log(i)}
              style={{
                transform: `scale(${1 * bgDimensions.scaleH}%)`,
                bottom: `${item.bottom * bgDimensions.height}px`,
                left:
                  bgDimensions.height == window.innerHeight
                    ? `${bgDimensions.width * item.left - (bgDimensions.width - window.innerWidth) / 2}px`
                    : `${(item.left - 0.03) * bgDimensions.width}px`,
              }}
            >
              {item.icon}
            </Item>
          ))}
      </ScrollableContainer>
    </Container>
  );
};

const Container = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 0;
`;
const LeftBlur = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 50%;
  filter: blur(10px);
  background-image: linear-gradient(to right, #0d0b0c, rgba(13, 11, 12, 0) 100%);
  opacity: 1;
  z-index: 0;
`;

const RightBlur = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: 50%;
  background-image: linear-gradient(to left, #0d0b0c, rgba(13, 11, 12, 0) 100%);
  opacity: 0.5;
  z-index: 0;
`;

const Clouds = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  margin: auto;
  height: 100%;
  width: auto;
  background-image: url(${clouds});
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 1;
  pointer-events: none;
  z-index: -1;
`;

const ScrollableContainer = styled.div`
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow-y: hidden;
  overflow-x: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 1;
`;

const Building = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  margin: auto;
  height: 100%;
  width: auto;
  padding: 25px 0;
  pointer-events: none;
  z-index: 1;
`;

const Item = styled.div`
  position: absolute;
  transform-origin: bottom left;
  height: 4.5rem;
  width: 4.5rem;
  border-radius: 100%;
  border: 0.3rem solid black;
  background-color: black;
  opacity: 0.95;
  transition: opacity 150ms;
  z-index: 2;
  color: #b37e55b2;
  font-weight: bold;
  font-size: 2rem;
  font-family: serif;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 300ms ease;
  &:hover {
    opacity: 1;
    cursor: pointer;
    color: #b37e55;
    border: 0.3rem solid #b37e55;
  }
`;

export default Roadmap;
