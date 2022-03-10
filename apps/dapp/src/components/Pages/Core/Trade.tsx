import React from 'react';
import styled from 'styled-components';
import { Dropdown } from 'components/Dropdown/Dropdown';
import dividerSVG from 'assets/images/divider.svg';

export const Trade = () => {
  return (
    <Container>
      <Divider />
      <Dropdown selected={'FRAX'} options={['a', 'b', 'c']} />
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  justify-content: center;

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
`;
