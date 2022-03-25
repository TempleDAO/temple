import styled from 'styled-components';

import { pixelsToRems } from 'styles/mixins';

export const Duration = styled.span`
  display: flex;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9375rem; /* 15/16 */
  line-height: 1.1875rem;
  text-transform: uppercase;
  text-align: center;
  letter-spacing: 0.25em;
  color: ${({ theme }) => theme.palette.brandLight};
`;

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  padding: calc(${pixelsToRems(10)}rem + 1.25rem) 1.25rem 1rem;
  width: 80%;
  margin: 0 auto;
  height: 100%;
`;
