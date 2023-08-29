import * as R3F from '@react-three/fiber';
import { Suspense, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { FoldingState } from './FoldingEngine';
import { FoldingSheet, FoldingSheetWithContext } from './FoldingSheet';
import { FoldingEventEmitter, PointerEventEmitter, PuzzleSolvedEventEmitter } from './InputEventEmitter';
import { PuzzleImageCarousel } from './PuzzleImageCarousel';
import { PuzzleSpec, checkPuzzleSolution } from './puzzle-solution';
import { AbsoluteFillSpace } from './styled';

export default function FoldingPuzzle(props: {
  puzzles: PuzzleSpec[]
}) {
  const { puzzles } = props;
  const pointerEventEmitter = useMemo(() => new PointerEventEmitter(), []);
  const foldingEventEmitter = useMemo(() => new FoldingEventEmitter(), []);
  const puzzleSolvedEventEmitter = useMemo(() => new PuzzleSolvedEventEmitter(), []);

  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [buttonState, setButtonState] =
    useState<FoldingState>({ canUndo: false, canRedo: false });
  const [dialogState, setDialogState] = useState<{ heading: string, subheading: string } | undefined>(undefined);

  const foldingSheetRef = useRef<FoldingSheet>(null);

  return (
    <PuzzleContainer>
      <PuzzleImageCarousel
        imgUrls={puzzles.map(p => p.imgUrl)}
        puzzleSolvedEventEmitter={puzzleSolvedEventEmitter}
      />
      <CanvasContainer
        onPointerDown={e => pointerEventEmitter.emit('pointerdown', e)}
        onPointerMove={e => pointerEventEmitter.emit('pointermove', e)}
        onPointerUp={e => pointerEventEmitter.emit('pointerup', e)}
      >
        <WidthEqualHeight/>
        <AbsoluteFillSpace>
          <R3F.Canvas flat linear
            camera={{ fov: 6.5, near: 90, far: 150, position: [0, 0, 110]}}
            style={{ backgroundColor: 'rgba(0, 0, 0, 0)' }}
          >
            <ambientLight args={[0xffffff, 1]} />
            <Suspense fallback={null}>
              <FoldingSheetWithContext
                foldingSheetRef={foldingSheetRef}
                pointerEventEmitter={pointerEventEmitter}
                foldingEventEmitter={foldingEventEmitter}
                onFoldingStateChange={setButtonState}
                onFoldingLinesChange={foldingLines => {
                  const { solution } = puzzles[puzzleIdx];
                  const isSolved = checkPuzzleSolution(foldingLines, solution);
                  console.log({ foldingLines, solution, isSolved })
                  if (isSolved) {
                    setDialogState({
                      heading: "Solved",
                      subheading: `${puzzleIdx + 1}/${puzzles.length}`,
                    });
                  }
                }}
              />
            </Suspense>
          </R3F.Canvas>
        </AbsoluteFillSpace>
      </CanvasContainer>
      <ButtonContainer>
        <PuzzleButton disabled={!buttonState.canUndo}
          onClick={() => {
            foldingEventEmitter.emit('unfold')
          }}
        >
          Unfold
        </PuzzleButton>
        <PuzzleButton disabled={!buttonState.canRedo}
          onClick={() => {
            foldingEventEmitter.emit('refold')
          }}
        >
          Refold
        </PuzzleButton>
      </ButtonContainer>
      <PuzzleDialog
        content={dialogState}
        onClose={() => {
          setDialogState(undefined);
          foldingSheetRef.current?.unfoldAll(() => {
            puzzleSolvedEventEmitter.emit('solved', puzzleIdx);
            setPuzzleIdx(puzzleIdx + 1);
          });
        }}
      />
    </PuzzleContainer>
  )
}

function PuzzleDialog(props: {
  content?: { heading: string, subheading: string }
  onClose: () => void
}) {
  return (
    <Overlay visible={!!props.content}>
      { props.content && (
        <DisplayBlock>
          <h1>{ props.content.heading }</h1>
          <h1>{ props.content.subheading }</h1>
          <br/>
          <PuzzleButton onClick={props.onClose}>
            Continue
          </PuzzleButton>
        </DisplayBlock>
      )}
    </Overlay>
  )
}

const Overlay = styled.div<{ visible?: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${({ visible }) => visible ? 100 : -1};;
  opacity: ${({ visible }) => visible ? 1 : 0};
  transition: opacity .5s ease-in-out;
  background: rgba(0, 0, 0, .5);
`

const DisplayBlock = styled.div`
  text-align: center;
  align-items: center;
  padding: 50px 0;
  width: 60%;
  height: 500px;

  & > h1 {
    flex: 1;
    color: white;
  }
`

const PuzzleContainer = styled.div`
  position: relative;
  max-width: 700px;
  margin: auto;
  padding: 20px;
`

const CanvasContainer = styled.div`
  position: relative;
  min-height: 400px;
  min-width: 400px;
  overflow: hidden;
`

const WidthEqualHeight = styled.div`
  padding-top: 100%;
`

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 80%;
  margin: auto;
`

const PuzzleButton = styled.button`
  flex: 1;
  margin: 12px;
  font-size: 1.5rem;
  color: #2df6a7;
  background: rgb(11, 10, 10);
  border: 1px solid #2df6a7;
  padding: 1rem 2rem;
  border-radius: 12px;
  cursor: pointer;

  &:disabled {
    color: gray;
    border-color: gray;
  }
`