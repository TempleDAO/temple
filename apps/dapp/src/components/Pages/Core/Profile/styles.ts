import styled from 'styled-components';

export const Container = styled.div`
  margin-top: 2rem;
  display: flex;
  flex-direction: column;

  a {
    width: max-content;
  }
`;

export const Subheading = styled.h4<{
  textAlign?: 'left' | 'center' | 'right';
}>`
  margin-top: 0;
`;

export const CenterContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;
