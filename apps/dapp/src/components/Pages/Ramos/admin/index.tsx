import { useState, useEffect } from 'react';
import styled, { css } from 'styled-components';
import { BigNumber, ethers } from 'ethers';

import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { tabletAndAbove } from 'styles/breakpoints';
import { useWallet } from 'providers/WalletProvider';
import environmentConfig from 'constants/env';
import { RAMOSGoerli__factory } from 'types/typechain';
import { AMO__IBalancerVault__factory } from 'types/typechain/factories/AMO__IBalancerVault__factory';
import { AMO__IBalancerVault } from 'types/typechain/AMO__IBalancerVault';
import { IBalancerHelpers__factory } from 'types/typechain/factories/IBalancerHelpers__factory';
import { toAtto, ZERO } from 'utils/bigNumber';

import { useRamosAdmin } from './useRamosAdmin';

const Container = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 4rem;
  ${tabletAndAbove(css`
    grid-template-columns: 1fr 1fr;
  `)}
`;

const InputArea = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const RequestArea = styled.code`
  overflow-wrap: anywhere;
`;

const RamosAdmin = () => {
  const { tokens, joinPoolInfo, createJoinPoolRequest } = useRamosAdmin();
  const [exitAmountBpt, setExitAmountBpt] = useState(ZERO);
  const [amounts, setAmounts] = useState<BigNumber[]>([]);
  const [exitPoolRequest, setExitPoolRequest] = useState<AMO__IBalancerVault.ExitPoolRequestStruct>();
  const { signer } = useWallet();

  const createExitPoolRequest = async () => {
    if (signer) {
      const address = await signer.getAddress();
      const { ramos, balancerHelpers } = environmentConfig.contracts;
      const RAMOS_CONTRACT = new RAMOSGoerli__factory(signer).attach(ramos);
      const POOL_ID = await RAMOS_CONTRACT.balancerPoolId();
      const BALANCER_VAULT_ADDRESS = await RAMOS_CONTRACT.balancerVault();
      const BALANCER_VAULT_CONTRACT = AMO__IBalancerVault__factory.connect(BALANCER_VAULT_ADDRESS, signer);
      const BALANCER_HELPERS_CONTRACT = IBalancerHelpers__factory.connect(balancerHelpers, signer);

      const [tokens, ,] = await BALANCER_VAULT_CONTRACT.getPoolTokens(POOL_ID);

      const queryUserData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [1, exitAmountBpt]);

      const queryExitReq: AMO__IBalancerVault.ExitPoolRequestStruct = {
        assets: tokens,
        minAmountsOut: [toAtto(1), toAtto(1)],
        userData: queryUserData,
        toInternalBalance: false,
      };
      const { bptIn, amountsOut } = await BALANCER_HELPERS_CONTRACT.queryExit(POOL_ID, address, address, queryExitReq);

      const userData = ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [1, bptIn]);

      const finalRequest: AMO__IBalancerVault.ExitPoolRequestStruct = {
        assets: tokens,
        minAmountsOut: amountsOut,
        userData: userData,
        toInternalBalance: false,
      };

      setExitPoolRequest(finalRequest);
    }
  };

  useEffect(() => {
    const initAmounts: BigNumber[] = [];
    tokens?.forEach(_ => {
      initAmounts.push(ZERO);
    });
    setAmounts(initAmounts);
  }, [tokens]);

  return (
    <>
      <Container>
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
          <Button isSmall label="CREATE REQUEST PARAMS" onClick={createExitPoolRequest} />
          <RequestArea>{`[[${exitPoolRequest?.assets
            .map((asset) => `"${asset}"`)
            .join(',')}],[${exitPoolRequest?.minAmountsOut.map((amount) => `"${amount}"`).join(',')}],"${
            exitPoolRequest?.userData
          }",false]`}</RequestArea>
        </InputArea>
      </Container>
    </>
  );
};

export default RamosAdmin;
