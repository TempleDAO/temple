import { useRef, FC, ReactNode, useEffect } from 'react';
import styled from 'styled-components';
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
        {showCloseButton && <XIcon onClick={() => onClose()} />}
        <div>{children}</div>
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

const Header = styled.h4`
  font-size: 1.5rem;
  text-align: center;
  color: ${({ theme }) => theme.palette.brandLight};
  margin-top: 0;
  margin-bottom: 1rem;
`;

const Wrapper = styled.div<{ isOpen: boolean }>`
  display: ${({ isOpen }) => (isOpen ? 'flex' : 'none')};
  background: #0b0a0a;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  padding: 1.5rem 2rem 2rem;
  flex-direction: column;
  box-shadow: 0 0 4rem rgba(0, 0, 0, 0.8);
  border-radius: 15px;
  border: 1px solid #68452d;
`;

const Dimmer = styled.div`
  background: rgba(0, 0, 0, 0.4);
  position: fixed;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  z-index: 9;
`;
