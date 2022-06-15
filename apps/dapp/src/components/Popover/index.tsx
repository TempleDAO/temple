import { useRef, FC, ReactNode, useEffect } from 'react';
import styled, { css } from 'styled-components';

import { tabletAndAbove } from 'styles/breakpoints';
import { backgroundImage, buttonResets } from 'styles/mixins';
import { useOutsideClick } from 'hooks/use-outside-click';

import hamburgerX from 'assets/icons/core-x-hamburger.svg';

interface Props {
  onClose: () => void;
  isOpen: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  header?: ReactNode;
}

// TODO(Fujisawa): Make reusable popover that animates open/shut.
export const Popover: FC<Props> = ({
  onClose,
  isOpen,
  closeOnClickOutside = false,
  showCloseButton = true,
  closeOnEscape = false,
  children,
  header,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useOutsideClick(ref, () => {
    if (!closeOnClickOutside) {
      return;
    }

    onClose();
  });

  useEffect(() => {
    if (!closeOnEscape || !isOpen) {
      return;
    }

    const onEscape = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') {
        onClose();
      };
    };

    window.addEventListener('keyup', onEscape);

    return () => {
      window.removeEventListener('keyup', onEscape);
    };
  }, [closeOnEscape, isOpen]);

  return (
    <>
      {isOpen && <Dimmer />}
      <Wrapper ref={ref} isOpen={isOpen}>
        {header && <Headear>{header}</Headear>}
        {showCloseButton && <XIcon onClick={() => onClose()}/>}
        <div>
          {children}
        </div>
      </Wrapper>
    </>
  );
};

const XIcon = styled.button`
  ${backgroundImage(hamburgerX)}
  ${buttonResets}
  width: 1.25rem;
  height: 1.25rem;
  position: absolute;
  right: 2rem;
  top: 1.5rem;
`;

const Headear = styled.h4`
  color: ${({ theme }) => theme.palette.brand};
  margin-top: 0;

  font-size: 1.5rem;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
  font-weight: 300;
`;

const Wrapper = styled.div<{ isOpen: boolean }>`
  display: ${({ isOpen }) => isOpen ? 'flex' : 'none'};
  background: #1D1A1A;
  position: fixed;
  left: 0;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  padding: 1.5rem 2rem 2rem;
  flex-direction: column;

  ${(tabletAndAbove(css`
    width: 26rem; // 416px
    left: 50%;
    top: 50%;
    right: auto;
    bottom: auto;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 4rem rgba(0, 0, 0, .8);
    border-radius: 15px;
    border: 1px solid #68452d;
  `))}
`;

const Dimmer = styled.div`
  background: rgba(0, 0, 0, .4);
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
`;