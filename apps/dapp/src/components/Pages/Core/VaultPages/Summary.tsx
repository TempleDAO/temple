import styled from 'styled-components';

import useVaultContext from './useVaultContext';

import { pixelsToRems } from 'styles/mixins';
import { Duration as BaseDuration, Wrapper as BaseWrapper } from './styles';

const Summary = () => {
  const vault = useVaultContext();

  return (
    <Wrapper>
      <InfoWrapper>
        <Percentage>
          45%
        </Percentage>
        <Color>
          Green
        </Color>
      </InfoWrapper>
      <Duration>
        {vault.months} Months
      </Duration>
    </Wrapper>
  );
};

const COLOR_PERCENTAGE_TEXT_SHADOW = '0px 0px 7px rgba(222, 92, 6, 0.5)'
const DURATION_MARGIN_PIXELS = 78;

const Wrapper = styled(BaseWrapper)`
  padding-top: 0;
  padding-bottom: 0;
`;

const InfoWrapper = styled.div`
  display: flex;
  align-ites: center;
  justify-content: center;
  flex-direction: column;
  height: 100%;
  margin-bottom -${pixelsToRems(DURATION_MARGIN_PIXELS)}rem;
`;

const Percentage = styled.span`
  ${({ theme }) => theme.typography.fonts.fontHeading}
  color: ${({ theme }) => theme.palette.brandLight};
  display: block;
  font-size: 6rem;
  line-height: 7rem;
  text-align: center;
  text-shadow: ${COLOR_PERCENTAGE_TEXT_SHADOW};
`;

const Duration = styled(BaseDuration)`
  margin-bottom: ${pixelsToRems(DURATION_MARGIN_PIXELS)}rem;
`;

const Color = styled.span`
  ${({ theme }) => theme.typography.fonts.fontBody}
  display: block;
  font-style: normal;
  font-weight: 400;
  font-size: 3rem;
  line-height: 3.5rem;
  text-align: center;
  letter-spacing: 0.05em;
  text-transform: uppercase;

  color: ${({ theme }) => theme.palette.brandLight};

  text-shadow: ${COLOR_PERCENTAGE_TEXT_SHADOW};
`;

export default Summary;