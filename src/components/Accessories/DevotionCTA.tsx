import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import Image from 'components/Image/Image';
import { useWallet } from 'providers/WalletProvider';
import devotionImage from 'assets/images/DEVOTION.svg';
import growthImage from 'assets/images/GROWTH.svg';
import {
  TempleFraxAMMRouter__factory,
  AmmIncentivisor__factory,
} from 'types/typechain';
import { JsonRpcSigner } from '@ethersproject/providers';
import { fromAtto } from 'utils/bigNumber';

const ENV_VARS = import.meta.env;
const TEMPLE_V2_ROUTER_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_V2_ROUTER_ADDRESS;
const AMM_INCENTIVISOR_ADDRESS = ENV_VARS.VITE_PUBLIC_AMM_INCENTIVISOR_ADDRESS;

const Container = styled.div`
  position: absolute;
  top: -0.5rem;
  left: 0;
  padding: 1rem;
  z-index: ${(props) => props.theme.zIndexes.top};
  &:hover {
    filter: brightness(150%);
  }
`;

const DevotionCTA = () => {
  const { claim, signer } = useWallet();
  const [blocksForIncentive, setBlocksForIncentive] = useState(0);
  const [priceBelowBlock, setPriceBelowBlock] = useState(0);

  const getStatus = async (signer: JsonRpcSigner) => {
    const AMMRouter = new TempleFraxAMMRouter__factory()
      .attach(TEMPLE_V2_ROUTER_ADDRESS)
      .connect(signer);
    const AMMIncentivisor = new AmmIncentivisor__factory()
      .attach(AMM_INCENTIVISOR_ADDRESS)
      .connect(signer);

    setBlocksForIncentive(
      fromAtto(await AMMRouter.priceCrossedBelowDynamicThresholdBlock())
    );
    setPriceBelowBlock(
      fromAtto(await AMMIncentivisor.numBlocksForUnlockIncentive())
    );
  };

  useEffect(() => {
    if (signer) getStatus(signer);
  }, [signer]);

  return (
    <>
      {priceBelowBlock == 0 ? (
        <Container>
          <Image src={growthImage} width={60} height={60} />
        </Container>
      ) : priceBelowBlock >= blocksForIncentive ? (
        <Container>
          <Image src={devotionImage} width={60} height={60} />
        </Container>
      ) : null}
    </>
  );
};

export default DevotionCTA;
