import { Button } from 'components/Button/Button';
import { InputStyled } from 'components/Input/Input';
import React, { useState } from 'react';
import styled, { css } from 'styled-components';

interface SlippageProps {
  value: number;
  label?: string;
  onChange(newValue: number): void;
}

const Slippage = ({ onChange, value, label }: SlippageProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [valueState, setValueState] = useState(value);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const x = +event.target.value > 0.5 ? +event.target.value : 0.5;
    setValueState(x);
    onChange(x);
  };

  return (
    <Container isOpen={isOpen}>
      <ContainerHeader onClick={() => setIsOpen(!isOpen)}>
        {label && <small>{label}</small>}
        <Value>
          {label && '--'}SLIPPAGE: ({valueState}%)
        </Value>
        <Indicator isOpen={isOpen} />
      </ContainerHeader>
      <ContainerContent>
        <Button
          //@ts-ignore
          tabIndex="-1"
          label={'DEFAULT'}
          isActive
          onClick={() => {
            onChange(1);
            setValueState(1);
          }}
          autoWidth
          isSmall
        />
        <SlippageInput
          //@ts-ignore
          tabIndex="-1"
          value={valueState}
          type={'number'}
          onChange={handleInputChange}
        />
      </ContainerContent>
    </Container>
  );
};

interface StyledProps {
  isOpen: boolean;
}

const Value = styled.small`
  margin-left: 0.5em;
  color: ${(props) => props.theme.palette.brand50};
`;

const Container = styled.div<StyledProps>`
  display: flex;
  flex-direction: column;
  border: 0.0625rem /* 1/16 */ solid ${(props) => props.theme.palette.brand25};
  padding: 1rem 2rem;
  width: 100%;
  height: 3rem /* 45/16 */;
  cursor: pointer;
  overflow: hidden;
  transition: height 250ms ease-in-out;

  ${(props) =>
    props.isOpen &&
    css`
      height: 7rem /* 110/16 */;
    `}
`;

const ContainerHeader = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  height: 3rem /* 45/16 */;
`;

const ContainerContent = styled.div`
  position: relative;
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;

  :before {
    content: '%';
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: 1rem;
  }
`;

const SlippageInput = styled(InputStyled)`
  margin-left: 1rem;
  height: 2.625rem /* 42/16 */;
  border: 1px solid ${(props) => props.theme.palette.brand25};
  padding-right: 2rem;
  ${(props) => props.theme.typography.meta};
`;

const Indicator = styled.div<StyledProps>`
  margin-left: auto;
  width: 0;
  height: 0;
  border-left: 0.75rem solid transparent;
  border-right: 0.75rem solid transparent;

  border-top: 1rem solid ${(props) => props.theme.palette.brand50};
  transition: transform 250ms ease-in-out;

  ${(props) =>
    props.isOpen &&
    css`
      transform: rotateX(180deg);
    `}
`;

export default Slippage;
