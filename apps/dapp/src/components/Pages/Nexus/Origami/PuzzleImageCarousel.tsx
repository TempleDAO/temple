import { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { PuzzleSolvedEventEmitter } from './InputEventEmitter';

export function PuzzleImageCarousel(props: {
  imgUrls: string[]
  puzzleSolvedEventEmitter: PuzzleSolvedEventEmitter
}) {
  const { imgUrls, puzzleSolvedEventEmitter } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const setPuzzleIdx = useCallback((idx: number) => {
    const newActiveIdx = idx % imgUrls.length;
    setActiveIdx(newActiveIdx);
    const container = containerRef.current;
    container?.scrollTo({ left: newActiveIdx * container.clientWidth / 3, behavior: 'smooth' });
  }, [containerRef, imgUrls, setActiveIdx]);

  useEffect(() => {
    const listenerKey = puzzleSolvedEventEmitter.addListeners({
      solved: idx => setPuzzleIdx(idx + 1)
    });
    return () => puzzleSolvedEventEmitter.removeListeners(listenerKey);
  }, [puzzleSolvedEventEmitter, setPuzzleIdx]);

  return (
    <PuzzleImageCarouselContainer ref={containerRef}>
      <CaroucelScrollablePanel style={{
        // padded by an empty cells before and after, each cell is 1/3 of the
        // outter container's width
        width: `${(imgUrls.length + 2) / 3 * 100}%`
      }}>
        <PuzzleImgCell/>
        { imgUrls.map((url, idx) => (
          <PuzzleImgCell key={idx}>
            <PuzzleImg src={url}
              active={idx == activeIdx}
              colored={idx <= activeIdx}
            />
          </PuzzleImgCell>
        ))}
        <PuzzleImgCell/>
      </CaroucelScrollablePanel>
    </PuzzleImageCarouselContainer>
  )
}

const PuzzleImageCarouselContainer = styled.div`
  width: 100%;
  overflow: hidden;
`

const CaroucelScrollablePanel = styled.div`
  display: flex;
  flex-direction: horizontal;
`

const PuzzleImgCell = styled.div`
  flex: 1;
  display: flex;
  height: 160px;
  // border: 1px solid white;
`

const PuzzleImg = styled.img<{ active?: boolean, colored?: boolean }>`
  width: ${({ active }) => active ? '160px' : '80px'};
  margin: auto;
  opacity: ${({ active }) => active ? 1 : 0.5};
  -webkit-filter: grayscale(${({ colored }) => colored ? 0 : 100}%); /* Safari 6.0 - 9.0 */
  filter: grayscale(${({ colored }) => colored ? 0 : 100}%);
  transition: all 0.5s ease-in-out;
`

