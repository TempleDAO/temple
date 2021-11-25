import { useEffect, useRef, useState } from 'react';
import styled, { css } from 'styled-components';
import Image from 'components/Image/Image';
import { useNotification } from 'providers/NotificationProvider';
import crossImage from 'assets/images/cross.svg';
import openInNewTabImage from 'assets/images/open-in-new.svg';

export type NotificationProps = {
  // Transaction Hash
  hash: string;
  // The title for the notification
  title: string;
};

const ETHERSCAN_DOMAIN =
  process.env.NODE_ENV === 'production'
    ? 'https://etherscan.io'
    : 'https://rinkeby.etherscan.io';

const Notification = ({ hash, title }: NotificationProps) => {
  const { closeNotification } = useNotification();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setIsOpen(false);
    // avoids the notification disappearing before the animation ends
    containerRef?.current?.addEventListener(
      'transitionend',
      () => closeNotification(hash),
      {
        once: true,
      }
    );
  };

  useEffect(() => {
    // Done in a timeout to allow animation to work
    setTimeout(() => setIsOpen(true), 100);
  }, []);

  return (
    <NotificationStyled isOpen={isOpen} ref={containerRef}>
      <CloseIcon>
        <Image
          src={crossImage}
          alt={'Close notification'}
          width={24}
          height={24}
          onClick={close}
          objectPosition={'right'}
        />
      </CloseIcon>
      <h5 title={title}>{title}</h5>
      <a
        href={`${ETHERSCAN_DOMAIN}/tx/${hash}`}
        target={'_blank'}
        rel="noreferrer"
      >
        View Transaction
        <Image
          src={openInNewTabImage}
          alt={'Open transaction on Etherscan'}
          width={24}
          height={24}
        />
      </a>
    </NotificationStyled>
  );
};

interface NotificationStyledProps {
  isOpen: boolean;
}

const NotificationStyled = styled.div<NotificationStyledProps>`
  position: relative;
  transform: translateX(150%);
  background-color: ${(props) => props.theme.palette.dark75};
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand};
  padding: 1rem;
  box-shadow: ${(props) => props.theme.shadows.base};
  transition: transform 450ms;

  ${(props) =>
    props.isOpen &&
    css`
      transform: translateX(0);
    `}
  h5 {
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    margin: 0 0 1rem;
  }

  a {
    display: flex;
    align-items: center;

    // this is the Image for external link
    div {
      margin-left: 1rem;
    }
  }
`;

const CloseIcon = styled.div`
  position: absolute;
  top: -0.75rem /* 12/16 */;
  right: -0.75rem /* 12/16 */;
  border-radius: 50%;
  background-color: ${(props) => props.theme.palette.brand50};
  cursor: pointer;
`;

export default Notification;
