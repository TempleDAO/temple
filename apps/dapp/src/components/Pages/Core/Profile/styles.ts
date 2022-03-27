import styled from 'styled-components';

export const Container = styled.div`
  padding: 2rem;
  display: flex;
  justify-content: center;
  a {
    width: max-content;
  }
`;

export const Heading = styled.h2`
  ${({ theme }) => theme.typography.h2};
  margin: 0;
`;

export const Subheading = styled.h3`
  ${({ theme }) => theme.typography.h4};
  margin-top: 0;
`;
