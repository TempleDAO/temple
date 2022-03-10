import React, { PropsWithChildren } from 'react';
import styled from 'styled-components';
import dividerSVG from 'assets/images/divider.svg';

interface DividerContainerProps extends PropsWithChildren<any> {
  dark?: boolean;
}

export const DividerContainer = ({
  children,
  dark,
}: PropsWithChildren<any>) => (
  <Container dark={dark}>
    {children[0]}
    <Divider />
    {children[1]}
  </Container>
);

const Container = styled.div<{ dark?: boolean }>`
  display: flex;

  width: 100%;
  height: 7rem /* 112/16 */;
  box-sizing: border-box;
  padding: 1rem;

  border: 2px solid ${({ theme }) => theme.palette.brand};
  border-radius: 16px;

  background-color: ${({ theme, dark }) =>
    dark ? 'black' : theme.palette.brand25};
`;

const Divider = styled.img.attrs({
  src: dividerSVG,
})`
  display: inline-block;
  padding: 0 1rem;
`;
