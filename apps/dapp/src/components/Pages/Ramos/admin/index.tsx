import { useState, useEffect } from 'react';
import styled, { css } from 'styled-components';
import { BigNumber, ethers } from 'ethers';

import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { tabletAndAbove } from 'styles/breakpoints';
import { ZERO } from 'utils/bigNumber';

import { useRamosAdmin } from './useRamosAdmin';

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 2rem;
  ${tabletAndAbove(css`
    grid-template-columns: 1fr 1fr;
  `)}
`;

const CalculatorArea = styled.div`
  grid-column: 1/-1;
`;

const InputArea = styled.div`
  h3 {
    margin-top: 0.5rem;
  }
  display: flex;
  border: ${({ theme }) => `1px solid ${theme.palette.brand}`};
  border-radius: 2rem;
  padding: 1rem;
  flex-direction: column;
  gap: 1rem;
`;

const RequestArea = styled.code`
  overflow-wrap: anywhere;
`;

const RamosAdmin = () => {
  const { createJoinPoolRequest, joinPoolInfo, createExitPoolRequest, exitPoolRequest, tokens } = useRamosAdmin();
  const [exitAmountBpt, setExitAmountBpt] = useState(ZERO);
  const [amounts, setAmounts] = useState<BigNumber[]>([]);

  useEffect(() => {
    const initAmounts: BigNumber[] = [];
    tokens?.forEach((_) => {
      initAmounts.push(ZERO);
    });
    setAmounts(initAmounts);
  }, [tokens]);

  return (
    <Container>
      <CalculatorArea>
        <h3>Calculator</h3>
        <p>
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Alias quibusdam minus, hic molestias neque est ex
          sint provident, possimus, quo reiciendis quidem voluptatem totam aliquid ab. Doloremque provident sed
          laudantium!
        </p>
      </CalculatorArea>
      <InputArea>
        <h3>Join pool</h3>
        {tokens &&
          amounts.length === tokens.length &&
          tokens?.map((token, index) => (
            <Input
              key={token.address}
              crypto={{ kind: 'value', value: token.symbol }}
              value={ethers.utils.formatUnits(amounts[index])}
              isNumber
              small
              handleChange={(e: string) => {
                const updatedAmounts = [...amounts];
                updatedAmounts[index] = ethers.utils.parseUnits(e);
                setAmounts(updatedAmounts);
              }}
            />
          ))}
        <Button isSmall label="CREATE REQUEST PARAMS" onClick={() => createJoinPoolRequest(amounts)} />
        {joinPoolInfo && (
          <>
            <RequestArea>{joinPoolInfo.joinPoolRequest}</RequestArea>

            <RequestArea>{`${joinPoolInfo.minBptOut}`}</RequestArea>
          </>
        )}
      </InputArea>

      <InputArea>
        <h3>Exit pool</h3>
        <Input
          crypto={{ kind: 'value', value: 'BPT' }}
          value={ethers.utils.formatUnits(exitAmountBpt)}
          isNumber
          small
          handleChange={(e) => setExitAmountBpt(ethers.utils.parseUnits(`${e}`))}
        />
        <Button isSmall label="CREATE REQUEST PARAMS" onClick={() => createExitPoolRequest(exitAmountBpt)} />
        {exitPoolRequest && <RequestArea>{exitPoolRequest}</RequestArea>}
      </InputArea>
    </Container>
  );
};

export default RamosAdmin;
