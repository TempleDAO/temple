import { useState } from 'react';
import styled from 'styled-components';
import box from 'assets/icons/box.svg?react';
import checkmark from 'assets/icons/checkmark-in-box.svg?react';

type CustomCheckboxProps = {
  onToggle?: (checked: boolean) => void;
};

const Checkbox: React.FC<CustomCheckboxProps> = ({ onToggle }) => {
  const [checked, setChecked] = useState(false);

  const handleClick = () => {
    setChecked(!checked);
    if (onToggle) {
      onToggle(!checked);
    }
  };

  return (
    <CheckboxContainer
      onClick={handleClick}
      role="checkbox"
      aria-checked={checked}
    >
      <CheckboxSvgWrapper>
        <StyledCircle />
        {checked && <StyledCheckmark />}
      </CheckboxSvgWrapper>
    </CheckboxContainer>
  );
};

export default Checkbox;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
`;

const CheckboxSvgWrapper = styled.div`
  position: relative;
  width: 24px;
  height: 24px;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const StyledCircle = styled(box)`
  position: absolute;
  top: 0;
  left: 0;
  width: 24px;
  height: 24px;
`;

const StyledCheckmark = styled(checkmark)`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
`;
