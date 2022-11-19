import styled, { css } from 'styled-components';
import { Button } from 'components/Button/Button';
import { Input } from 'components/Input/Input';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { tabletAndAbove } from 'styles/breakpoints';
import { useState } from 'react';
import { DBN_ZERO, DecimalBigNumber } from 'utils/DecimalBigNumber';
import { ERC20__factory, RAMOSGoerli__factory } from 'types/typechain';
import { useWallet } from 'providers/WalletProvider';
import environmentConfig from 'constants/env';
import { AMO__IBalancerVault__factory } from 'types/typechain/factories/AMO__IBalancerVault__factory';
import { AMO__IBalancerVault } from 'types/typechain/AMO__IBalancerVault';
import { IBalancerHelpers__factory } from 'types/typechain/factories/IBalancerHelpers__factory';
import { fromAtto, toAtto, ZERO } from 'utils/bigNumber';
import { BigNumber, ethers } from 'ethers';

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
  const [joinAmountTemple, setJoinAmountTemple] = useState(ZERO);
  const [joinAmountFrax, setJoinAmountFrax] = useState(ZERO);
  const [joinPoolRequest, setJoinPoolRequest] = useState<AMO__IBalancerVault.JoinPoolRequestStruct>();
  const [minBptOut, setMinBptOut] = useState(ZERO);
  const [exitAmountBpt, setExitAmountBpt] = useState(ZERO);
  const [exitPoolRequest, setExitPoolRequest] = useState<AMO__IBalancerVault.ExitPoolRequestStruct>();
  const { signer } = useWallet();

  const createJoinPoolRequest = async () => {
    if (signer) {
      const address = await signer.getAddress();
      const { ramos, balancerHelpers } = environmentConfig.contracts;
      const RAMOS_CONTRACT = new RAMOSGoerli__factory(signer).attach(ramos);
      const POOL_ID = await RAMOS_CONTRACT.balancerPoolId();
      const BALANCER_VAULT_ADDRESS = await RAMOS_CONTRACT.balancerVault();
      const BALANCER_VAULT_CONTRACT = AMO__IBalancerVault__factory.connect(BALANCER_VAULT_ADDRESS, signer);
      const BALANCER_HELPERS_CONTRACT = IBalancerHelpers__factory.connect(balancerHelpers, signer);

      const [tokens, ,] = await BALANCER_VAULT_CONTRACT.getPoolTokens(POOL_ID);

      const amounts = [joinAmountTemple, joinAmountFrax];

      const queryUserData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256[]', 'uint256'],
        [1, amounts, 0]
      );
      const queryJoinRequest: AMO__IBalancerVault.JoinPoolRequestStruct = {
        assets: tokens,
        maxAmountsIn: amounts,
        userData: queryUserData,
        fromInternalBalance: false,
      };
      console.log(BALANCER_VAULT_ADDRESS)
      console.log(POOL_ID)
      const { amountsIn, bptOut } = await BALANCER_HELPERS_CONTRACT.queryJoin(
        POOL_ID,
        address,
        address,
        queryJoinRequest
      );

      setMinBptOut(bptOut);
      const userData = ethers.utils.defaultAbiCoder.encode(
        ['uint256', 'uint256[]', 'uint256'],
        [1, amountsIn, bptOut]
      );
      const finalRequest: AMO__IBalancerVault.JoinPoolRequestStruct = {
        assets: tokens,
        maxAmountsIn: amountsIn,
        userData: userData,
        fromInternalBalance: false,
      };

      setJoinPoolRequest(finalRequest);
    }
  };

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
        toInternalBalance: false
      }

      setExitPoolRequest(finalRequest)
    }
  };

  return (
    <>
      <Container>
        <InputArea>
          <h3>Join pool</h3>
          <Input
            crypto={{ kind: 'value', value: 'TEMPLE' }}
            value={ethers.utils.formatUnits(joinAmountTemple)}
            isNumber
            small
            handleChange={(e) => setJoinAmountTemple(ethers.utils.parseUnits(`${e}`))}
          />
          <Input
            crypto={{ kind: 'value', value: 'FRAX' }}
            value={ethers.utils.formatUnits(joinAmountFrax)}
            isNumber
            small
            handleChange={(e) => setJoinAmountFrax(ethers.utils.parseUnits(`${e}`))}
          />
          <Button isSmall label="CREATE REQUEST PARAMS" onClick={createJoinPoolRequest} />
          <RequestArea>{`[[${joinPoolRequest?.assets
            .map((asset) => `"${asset}"`)
            .join(',')}],[${joinPoolRequest?.maxAmountsIn.map((amount) => `"${amount}"`).join(',')}],"${
            joinPoolRequest?.userData
          }",false]`}</RequestArea>

          <RequestArea>{`${minBptOut}`}</RequestArea>
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
