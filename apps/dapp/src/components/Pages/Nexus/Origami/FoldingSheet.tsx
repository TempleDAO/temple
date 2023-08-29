import { Component, useEffect, useRef } from 'react';
import { FoldingAnimation } from './FoldingAnimation';
import { FoldingEngine, FoldingState, RenderInfo } from './FoldingEngine';
import { InputProcessor } from './InputCapture';
import { FoldingEventEmitter, PointerEventEmitter } from './InputEventEmitter';
import { Line2 } from './origami-types';

export const FoldingSheetWithContext: React.FC<{
  foldingSheetRef: React.RefObject<FoldingSheet>
  pointerEventEmitter: PointerEventEmitter
  foldingEventEmitter: FoldingEventEmitter
  onFoldingStateChange: (state: FoldingState) => void
  onFoldingLinesChange: (foldingLines: Line2[]) => void
}> = props => {
  const { foldingSheetRef, pointerEventEmitter, foldingEventEmitter } = props;  
  useEffect(() => {
    const foldingEventListenerKey = foldingEventEmitter.addListeners({
      unfold: () => foldingSheetRef.current?.unfold(),
      refold: () => foldingSheetRef.current?.refold(),
    })
    return () => {
      foldingEventEmitter.removeListeners(foldingEventListenerKey);
    };
  }, [foldingEventEmitter]);

  return <>
    <FoldingSheet ref={foldingSheetRef}
      onFoldingStateChange={props.onFoldingStateChange}
      onFoldingLinesChange={props.onFoldingLinesChange}
    />
    <InputProcessor pointerEventEmitter={pointerEventEmitter}
      onFold={line => foldingSheetRef.current?.fold(line)}
    />
  </>
}

export class FoldingSheet extends Component<{
  onFoldingStateChange: (state: FoldingState) => void
  onFoldingLinesChange: (foldingLines: Line2[]) => void
}, { renderInfo: RenderInfo, folding: boolean, unfoldAllComplete?: (() => void) }> {
  private readonly engine: FoldingEngine;

  constructor(props: {
    onFoldingStateChange: (state: FoldingState) => void
    onFoldingLinesChange: (foldingLines: Line2[]) => void
  }) {
    super(props);
    this.engine = new FoldingEngine(10);
    this.state = {
      renderInfo: this.engine.getFixedRenderInfo(),
      folding: false,
      unfoldAllComplete: undefined,
    };
  }

  fold(line: Line2) {
    this.updateRenderInfo(this.engine.fold(line));
  }

  unfold() {
    this.updateRenderInfo(this.engine.unfold());
  }

  refold() {
    this.updateRenderInfo(this.engine.refold());
  }

  unfoldAll(onComplete: () => void) {
    if (this.canUndo) {
      this.setState({ unfoldAllComplete: onComplete });
      this.unfold();
    }
  }

  private updateRenderInfo(renderInfo?: RenderInfo) {
    if (renderInfo && !this.state.folding) {
      this.props.onFoldingStateChange({ canRedo: false, canUndo: false });  
      this.setState({ folding: true, renderInfo });
    }
  }

  render() {
    return (
      <>
        <FoldingAnimation
          key={this.state.renderInfo.key}
          renderInfo={this.state.renderInfo}
          onComplete={() => {
            const renderInfo = this.engine.getFixedRenderInfo();
            this.setState({ folding: false, renderInfo });
            this.props.onFoldingStateChange(this.engine.getFoldingState());
            this.props.onFoldingLinesChange(this.engine.getFoldingLines());

            const { unfoldAllComplete } = this.state;
            if (unfoldAllComplete) {
              this.performUnfoldAll(unfoldAllComplete);
            }
          }}
        />
      </>
    );
  }

  private performUnfoldAll(onComplete: () => void) {
    setTimeout(() => {
      if (this.canUndo) {
        this.unfold();
      } else {
        setTimeout(onComplete);
        this.setState({
          renderInfo: this.engine.resetStateStack(),
          unfoldAllComplete: undefined,
        });
        this.props.onFoldingStateChange(this.engine.getFoldingState());
      }
    });
  }

  private get canUndo() {
    return this.engine.getFoldingState().canUndo;
  }
}
