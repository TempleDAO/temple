import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';
import styled from 'styled-components';

const SpiceBazaarActivate = () => {
  const { featureFlag } = useSpiceBazaar();
  const { isEnabled, toggle } = featureFlag;

  return (
    <>
      <Title>Feature Activation</Title>
      <ToggleButton enabled={isEnabled} onClick={toggle}>
        {isEnabled ? 'Enabled' : 'Disabled'}
      </ToggleButton>
    </>
  );
};

export default SpiceBazaarActivate;

const Title = styled.h1`
  font-size: 20px;
`;

const ToggleButton = styled.button<{ enabled: boolean }>`
  padding: 8px 16px;
  border-radius: 6px;
  color: ${({ theme }) => theme.palette.brandLight};
  background-color: ${({ theme, enabled }) =>
    enabled ? theme.palette.brand : theme.palette.brandDarker};
  border: none;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
`;
