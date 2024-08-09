import styled from 'styled-components';

export const COLOR_HEADER_SHADOW = '0px 4px 7.48px rgba(222, 92, 6, 0.5)';

export const Header = styled.h2`
  margin: 0 0 0.2rem;
  padding: 1rem 0 0;
  font-size: 3rem;
  line-height: 3.5rem;
  text-align: center;
  text-shadow: ${COLOR_HEADER_SHADOW};
  color: ${({ theme }) => theme.palette.brandLight};
  font-weight: 300;
  display: block;
`;
