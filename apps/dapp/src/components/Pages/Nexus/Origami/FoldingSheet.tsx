import { EventEmitterBase, PointerEventEmitter } from './InputEventEmitter';
import { Component, useEffect, useRef } from 'react';
import { FoldingAnimation } from './FoldingAnimation';
import { FoldingEngine, FoldingState, RenderInfo } from './FoldingEngine';
import { InputProcessor } from './InputCapture';
import { Line2 } from './origami-types';

export class FoldingEventEmitter extends EventEmitterBase<'unfold' | 'refold', void> {}

export const FoldingSheetWithContext: React.FC<{
  pointerEventEmitter: PointerEventEmitter
  foldingEventEmitter: FoldingEventEmitter
  onFoldingStateChange: (state: FoldingState) => void
}> = props => {
  const { pointerEventEmitter, foldingEventEmitter } = props;
  const foldingSheetRef = useRef<FoldingSheet>(null);
  
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
    />
    <InputProcessor pointerEventEmitter={pointerEventEmitter}
      onFold={line => foldingSheetRef.current?.fold(line)}
    />
  </>
}

export class FoldingSheet extends Component<{
  onFoldingStateChange: (state: FoldingState) => void
}, { renderInfo: RenderInfo }> {
  private readonly engine: FoldingEngine;

  constructor(props: {
    onFoldingStateChange: (state: FoldingState) => void
  }) {
    super(props);
    this.engine = new FoldingEngine(10);
    this.state = { renderInfo: this.engine.getFixedRenderInfo() };
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

  private updateRenderInfo(renderInfo?: RenderInfo) {
    if (renderInfo) {
      this.setState({ renderInfo });
    }
    this.props.onFoldingStateChange(this.engine.getFoldingState());
  }

  render() {
    return (
      <>
        <FoldingAnimation
          key={this.state.renderInfo.key}
          renderInfo={this.state.renderInfo}
          onComplete={() => {
            const renderInfo = this.engine.getFixedRenderInfo();
            this.setState({ renderInfo });
          }}
        />
      </>
    );
  }
}
