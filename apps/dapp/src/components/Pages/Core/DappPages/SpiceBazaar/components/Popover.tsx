import { useRef, FC, ReactNode, useEffect } from 'react';
import styled from 'styled-components';
import { backgroundImage, buttonResets } from 'styles/mixins';
import { useOutsideClick } from 'hooks/use-outside-click';
import close from 'assets/icons/close.svg';

interface Props {
  onClose: () => void;
  isOpen: boolean;
  closeOnClickOutside?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  header?: ReactNode;
  children?: React.ReactNode;
}

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
    if (!closeOnClickOutside) return;
    onClose();
  });

  // Close modal on escape
  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;
    const onEscape = (evt: KeyboardEvent) => {
      if (evt.key === 'Escape') onClose();
    };
    window.addEventListener('keyup', onEscape);
    return () => window.removeEventListener('keyup', onEscape);
  }, [closeOnEscape, isOpen]);

  return (
    <>
      {isOpen && <Dimmer />}
      <Wrapper ref={ref} isOpen={isOpen}>
        {header && <Header>{header}</Header>}
        {showCloseButton && <CloseIcon onClick={() => onClose()} />}
        {children}
      </Wrapper>
    </>
  );
};

const CloseIcon = styled.button`
  ${backgroundImage(close)}
  ${buttonResets}
  width: 24px;
  height: 24px;
  position: absolute;
  right: 2rem;
  top: 26.5px;
`;

const Header = styled.h4`
  font-size: 1.5rem;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
  background: 
  margin-top: 0;
  margin-bottom: 1rem;
`;

const Wrapper = styled.div<{ isOpen: boolean }>`
  display: ${({ isOpen }) => (isOpen ? 'flex' : 'none')};
  background: ${({ theme }) => theme.palette.black};
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  padding-bottom: 32px;
  flex-direction: column;
  max-height: 100vh; /* Fallback for older browsers */
  max-height: 100dvh; /* Dynamic viewport height - adjusts when keyboard appears */
  max-width: 100vw;
  overflow-y: auto;
  box-shadow: 0 0 4rem rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  border: 1px solid ${({ theme }) => theme.palette.brand};
  gap: 10px;
`;

const Dimmer = styled.div`
  background: rgba(0, 0, 0, 0.4);
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  z-index: 19;
`;
