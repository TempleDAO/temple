import { FC, KeyboardEventHandler } from 'react';

import { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { backgroundImage, buttonResets } from 'styles/mixins';
import hamburgerX from 'assets/icons/core-x-hamburger.svg';

export type OverlayContentProps = { startDismiss: () => void };
export type OverlayContentComponent = FC<OverlayContentProps>;

interface MobileNavOverlayProps {
  Content: OverlayContentComponent;
  widthPercent?: number;
  maxWidthRem?: number;

  // If true, pressing the esc key, or clicking outside the panel
  // will dismiss the panel.
  enableContextDismiss?: boolean;

  hidePanel: () => void;
}

export function MobileNavOverlay(props: MobileNavOverlayProps): JSX.Element {
  const [slideIn, setSlideIn] = useState(false);
  useEffect(() => setSlideIn(true), []);

  const enableDismissFromContext = props.enableContextDismiss || props.enableContextDismiss == undefined;

  // Slide out, then indicate to parent that we are done.
  const startDismiss = useCallback(() => {
    setSlideIn(false);
    setTimeout(props.hidePanel, SLIDE_MS);
  }, [props.hidePanel]);

  const handleKeyPress: KeyboardEventHandler = useCallback(
    (e) => {
      if (e.key === 'Escape' && enableDismissFromContext) {
        startDismiss();
      }
    },
    [startDismiss, enableDismissFromContext]
  );

  useEffect(() => {
    //@ts-ignore
    document.addEventListener('keydown', handleKeyPress, false);

    //@ts-ignore
    return () => document.removeEventListener('keydown', handleKeyPress, false);
  }, [handleKeyPress]);

  return (
    <>
      <WindowOverlay
        slideIn={slideIn}
        onClick={() => {
          if (enableDismissFromContext) {
            startDismiss();
          }
        }}
        onKeyPress={handleKeyPress}
      >
        <ContentPanel
          widthPercent={props.widthPercent || 50}
          maxWidthRem={props.maxWidthRem}
          slideIn={slideIn}
          onClick={(e) => e.stopPropagation()}
        >
          <XIcon onClick={startDismiss} />
          <ContentPanelInner onClick={(e) => e.stopPropagation()}>
            <props.Content startDismiss={startDismiss} />
          </ContentPanelInner>
        </ContentPanel>
      </WindowOverlay>
    </>
  );
}

const SLIDE_MS = 150;

const WindowOverlay = styled.div<{ slideIn: boolean }>`
  z-index: 80;
  position: fixed;
  display: flex;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  background-color: ${(props) => (props.slideIn ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0)')};
  transition: background-color ${SLIDE_MS}ms ease;
`;

const ContentPanel = styled.div<{
  slideIn: boolean;
  widthPercent: number;
  maxWidthRem?: number;
}>`
  z-index: 80;
  position: fixed;
  display: flex;
  overflow-y: auto;
  height: 100%;
  top: 0;
  right: 0;
  background-color: ${({ theme }) => theme.palette.black};
  transform: ${(props) => (props.slideIn ? 'translateX(0%)' : `translateX(100%)`)};
  transition: transform ${SLIDE_MS}ms ease;
  width: 100vw;
`;

const ContentPanelInner = styled.div`
  width: 100%;
`;

const XIcon = styled.button`
  ${backgroundImage(hamburgerX)}
  ${buttonResets}
  width: 1.25rem;
  height: 1.25rem;
  position: absolute;
  right: 2rem;
  top: 1.5rem;
  cursor: pointer;
`;
