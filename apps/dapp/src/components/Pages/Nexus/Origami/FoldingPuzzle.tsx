import * as R3F from '@react-three/fiber';
import { PointerEventEmitter } from './InputEventEmitter';
import { FoldingEventEmitter, FoldingSheetWithContext } from './FoldingSheet';
import { AbsoluteFillSpace } from './styled';
import { Suspense, useMemo, useState } from 'react';
import styled from 'styled-components';
import { FoldingState } from './FoldingEngine';
import { vec2 } from './vec2';
import { Line2, isLine2 } from './origami-types';

type LineEntry = Line2 | [Line2, LineEntry[]]

const PUZZLE_1: LineEntry[][] = [[
  [{ x: 0, y: 5}, { x: -5, y: 0 }],
  [{ x: -5, y: 0}, { x: 0, y: -5 }],
  [{ x: 0, y: -5}, { x: 5, y: 0 }],
  [{ x: 5, y: 0}, { x: 0, y: 5 }],
]]

const PUZZLE_2: LineEntry[][] = [[
  [[{ x: 0, y: 5}, { x: -5, y: 2.5 }], [[{ x: 0, y: 5}, { x: -5, y: 0 }]]],
  [[{ x: -5, y: 0}, { x: -2.5, y: -5 }], [[{ x: -5, y: 0}, { x: 0, y: -5 }]]],
  [[{ x: 0, y: -5}, { x: 5, y: -2.5 }], [[{ x: 0, y: -5}, { x: 5, y: 0 }]]],
  [[{ x: 5, y: 0}, { x: 2.5, y: 5 }], [[{ x: 5, y: 0}, { x: 0, y: 5 }]]],
]]

const PUZZLE_3: LineEntry[][] = [[
  [[{ x: 0, y: 5}, { x: -5, y: 0 }], [[{ x: 0, y: 5 }, { x: -5, y: -5 }]]],
  [[{ x: 5, y: 0}, { x: 0, y: 5 }], [[{ x: 5, y: -5 }, { x: 0, y: 5 }]]],
], [
  [{ x: -5, y: -2.5 }, { x: 5, y: -2.5 }]
]]

// traverse the solution tree and check if the lines match
function checkSolution(
  lines: Line2[],
  entriesList: Readonly<LineEntry[][]>,
  lineLookup: Record<string, LineEntry[] | undefined> = {}
): boolean {
  const entries = entriesList[0];
  if (entries && entries.length > 0) {
    entries.forEach(entry => {
      if (isLine2(entry)) {
        lineLookup[vec2.formatList(entry)] = [];
      } else {
        const [line, children] = entry;
        lineLookup[vec2.formatList(line)] = children
      }
    });
  } else if (entriesList.length > 0 && Object.keys(lineLookup).length == 0) {
    return checkSolution(lines, entriesList.slice(1), lineLookup);
  }

  console.log("lineLookup:", lineLookup);
  console.log("entriesList:", entriesList);

  const line = lines[0];
  const lineStr = line && vec2.formatList(line);
  if (lineStr) {
    const subEntries = lineLookup[lineStr];
    delete lineLookup[lineStr];
    if (subEntries) { // line matched
      lines.shift();
      return checkSolution(lines, [subEntries, ...entriesList.slice(1)], lineLookup);
    }
  }
  // solved when all lines are matched and all entries are used
  return lines.length == 0 && Object.keys(lineLookup).length == 0;
}

export default function FoldingPuzzle() {
  const pointerEventEmitter = useMemo(() => new PointerEventEmitter(), []);
  const foldingEventEmitter = useMemo(() => new FoldingEventEmitter(), []);
 
  const [buttonState, setButtonState] =
    useState<FoldingState>({ canUndo: false, canRedo: false, foldLines: [] });

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
                onFoldingStateChange={foldingState => {
                  setButtonState(foldingState)
                  console.log(foldingState.foldLines.map(line => vec2.formatList(line, '-')))
                  const solved = checkSolution(foldingState.foldLines, PUZZLE_3);
                  console.log(solved ? 'Solved!' : 'Not solved')
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
    </PuzzleContainer>
  )
}

function formatLine(line: Line2) {
  return vec2.formatList(line, '-')
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