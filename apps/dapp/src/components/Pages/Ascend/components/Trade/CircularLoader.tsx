import styled from 'styled-components';

interface Props {
  size?: number; // pixels
}

export const CircularLoader = ({ size = DEFAULT_SIZE }: Props) => (
  <Wrapper size={size}>
    <div />
    <div />
    <div />
    <div />
  </Wrapper>
);

const DEFAULT_SIZE = 25;

const Wrapper = styled.div<{ size: number }>`
  display: inline-block;
  position: relative;
  width: ${({ size }) => size}px;
  height: ${({ size }) => size}px;

  div {
    content: '';
    box-sizing: border-box;
    display: block;
    position: absolute;
    width: ${({ size }) => size * 0.8}px;
    height: ${({ size }) => size * 0.8}px;
    margin: ${({ size }) => size / 10}px;
    border: ${({ size }) => size / 10}px solid #fff;
    border-radius: 50%;
    animation: loading-animation 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
    border-color: ${({ theme }) => theme.palette.brand75} transparent
      transparent transparent;

    &:nth-child(1) {
      animation-delay: -0.45s;
    }

    &:nth-child(2) {
      animation-delay: -0.3s;
    }

    &:nth-child(3) {
      animation-delay: -0.15s;
    }
  }

  @keyframes loading-animation {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }
`;
