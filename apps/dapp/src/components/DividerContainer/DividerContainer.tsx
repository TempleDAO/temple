import React, { PropsWithChildren } from 'react';
import styled from 'styled-components';
import dividerSVG from 'assets/images/divider.svg';

const Container = styled.div`
  display: flex;

  width: 20rem /* 320/16 */;
  height: 7rem /* 112/16 */;
  box-sizing: border-box;
  padding: 1rem;

  border: 2px solid ${({ theme }) => theme.palette.brand};
  border-radius: 16px;

  background-color: ${({ theme }) => theme.palette.brand25};
`;

const Divider = styled.img.attrs({
  src: dividerSVG,
})`
  display: inline-block;
  padding: 0 1rem;
`;

export const DividerContainer = ({ children }: PropsWithChildren<any>) => (
  <Container>
    {children[0]}
    <Divider />
    {children[1]}
  </Container>
);
