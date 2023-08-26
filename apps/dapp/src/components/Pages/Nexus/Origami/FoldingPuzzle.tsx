import * as R3F from '@react-three/fiber';
import { PointerEventEmitter } from './InputEventEmitter';
import { FoldingEventEmitter, FoldingSheetWithContext } from './FoldingSheet';
import { AbsoluteFillSpace } from './styled';
import { Suspense, useMemo, useState } from 'react';
import styled from 'styled-components';

export default function FoldingPuzzle() {
  const pointerEventEmitter = useMemo(() => new PointerEventEmitter(), []);
  const foldingEventEmitter = useMemo(() => new FoldingEventEmitter(), []);
 
  const [buttonState, setButtonState] = useState({ canUndo: false, canRedo: false });

  return (
    <PuzzleContainer>
      <CanvasContainer
        onPointerDown={e => pointerEventEmitter.emit('pointerdown', e)}
        onPointerMove={e => pointerEventEmitter.emit('pointermove', e)}
        onPointerUp={e => pointerEventEmitter.emit('pointerup', e)}
      >
        <WidthEqualHeight/>
        <AbsoluteFillSpace>
          <R3F.Canvas flat linear
            camera={{ fov: 8, near: 90, far: 150, position: [0, 0, 110]}}
            style={{ backgroundColor: '#111' }}
          >
            <ambientLight args={[0xffffff, 1]} />
            <Suspense fallback={null}>
              <FoldingSheetWithContext
                pointerEventEmitter={pointerEventEmitter}
                foldingEventEmitter={foldingEventEmitter}
                onUndoStackChange={undoState => setButtonState(undoState)}
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
    </PuzzleContainer>
  )
}

const PuzzleContainer = styled.div`
  max-width: 800px;
  margin: auto;
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
  width: 100%;
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