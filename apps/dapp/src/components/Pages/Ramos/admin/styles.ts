import styled from 'styled-components';

export const InputArea = styled.div`
  h3 {
    margin-top: 0.5rem;
    margin-bottom: 0;
  }
  p {
    margin: 0;
  }
  display: flex;
  border: ${({ theme }) => `1px solid ${theme.palette.brand}`};
  border-radius: 2rem;
  padding: 1rem;
  flex-direction: column;
  gap: 1rem;
`;

export const RequestArea = styled.code`
  overflow-wrap: anywhere;
  color: ${({ theme }) => theme.palette.brand};
`;

export const TitleWrapper = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  small {
    margin-top: 0.5rem;
  }
`;
