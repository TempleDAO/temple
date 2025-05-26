import styled from 'styled-components';
import checkmark from 'assets/icons/check.svg?react';

type CustomCheckboxProps = {
  checked: boolean;
  onToggle?: (checked: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
};

const LargeRoundCheckBox: React.FC<CustomCheckboxProps> = ({
  checked,
  onToggle,
  disabled = false,
  children,
}) => {
  const handleClick = () => {
    if (disabled) return;
    if (onToggle) {
      onToggle(!checked);
    }
  };

  return (
    <CheckboxContainer onClick={handleClick} disabled={disabled}>
      <CheckboxSvgWrapper>
        <StyledCircle />
        <StyledCheckmark data-visible={checked} />
      </CheckboxSvgWrapper>
      {children && <Label disabled={disabled}>{children}</Label>}
    </CheckboxContainer>
  );
};

export default LargeRoundCheckBox;

const CheckboxContainer = styled.div<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;

const CheckboxSvgWrapper = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const StyledCircle = styled.div`
  display: inline-block;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background-color: #202020;
  border: 2px solid ${({ theme }) => theme.palette.brand};
`;

const StyledCheckmark = styled(checkmark)<{ 'data-visible': boolean }>`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 20px;
  height: 20px;
  opacity: ${({ 'data-visible': visible }) => (visible ? 1 : 0)};
  transition: opacity 0.2s ease;
`;

const Label = styled.div<{ disabled?: boolean }>`
  color: ${({ theme }) => theme.palette.brandLight};
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
`;
