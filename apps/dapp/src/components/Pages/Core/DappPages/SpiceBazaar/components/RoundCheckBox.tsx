import { useState } from 'react';
import styled from 'styled-components';

interface CustomCheckboxProps {
  children: React.ReactNode;
  onToggle: (checked: boolean) => void;
  disabled?: boolean;
}

const RoundCheckbox = ({
  children,
  onToggle,
  disabled = false,
}: CustomCheckboxProps) => {
  const [isChecked, setIsChecked] = useState(false);

  const handleToggle = () => {
    if (disabled) return;
    setIsChecked(!isChecked);
    onToggle(!isChecked);
  };

  return (
    <CheckboxContainer onClick={handleToggle} disabled={disabled}>
      <HiddenCheckbox
        type="checkbox"
        checked={isChecked}
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onChange={() => {}}
        disabled={disabled}
      />
      <StyledCheckbox checked={isChecked} disabled={disabled}>
        <Icon viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12" />
        </Icon>
      </StyledCheckbox>
      <Label disabled={disabled}>{children}</Label>
    </CheckboxContainer>
  );
};

const CheckboxContainer = styled.div<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: ${(props) => (props.disabled ? 'not-allowed' : 'pointer')};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
`;

const HiddenCheckbox = styled.input`
  border: 0;
  clip: rect(0 0 0 0);
  clippath: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

const StyledCheckbox = styled.div<{ checked: boolean; disabled?: boolean }>`
  display: inline-block;
  width: 16px;
  height: 16px;
  background: ${(props) =>
    props.checked ? props.theme.palette.brand : 'transparent'};
  border: 2px solid ${(props) => props.theme.palette.brand};
  border-radius: 50%;
  transition: all 150ms;
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};

  svg {
    visibility: ${(props) => (props.checked ? 'visible' : 'hidden')};
  }
`;

const Icon = styled.svg`
  fill: none;
  stroke: white;
  stroke-width: 2px;
`;

const Label = styled.span<{ disabled?: boolean }>`
  color: ${(props) => props.theme.palette.brandLight};
  opacity: ${(props) => (props.disabled ? 0.5 : 1)};
`;

export default RoundCheckbox;
