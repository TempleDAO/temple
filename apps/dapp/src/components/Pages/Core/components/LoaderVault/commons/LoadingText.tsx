import type { FC } from 'react';
import styled, { keyframes } from 'styled-components';
import { Loading } from 'utils/loading-value';

type LoadingTextProps = {
  value: Loading<string>;
  placeholder?: string;
  suffix?: string | React.ReactNode;
};

export const LoadingText: FC<LoadingTextProps> = (props) => {
  const placeholder = props.placeholder || '——';
  if (props.value.state === 'loading') {
    return (
      <LoadingPlaceholder>
        {placeholder}
        {props.suffix}
      </LoadingPlaceholder>
    );
  }
  return (
    <span>
      {props.value.value}
      {props.suffix}
    </span>
  );
};

const loadingAnimation = keyframes`
  0% { opacity: 1.0; }
  50% { opacity: 0.2; }
  100% { opacity: 1.0; }
 `;

const LoadingPlaceholder = styled.span`
  animation-name: ${loadingAnimation};
  animation-duration: 1s;
  animation-iteration-count: infinite;
`;
