import { JsonRpcSigner } from '@ethersproject/providers';
import devotionImage from 'assets/images/DEVOTION.svg';
import growthImage from 'assets/images/GROWTH.svg';
import Image from 'components/Image/Image';
import { useWallet } from 'providers/WalletProvider';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Devotion__factory } from 'types/typechain';

const ENV_VARS = import.meta.env;
const TEMPLE_DEVOTION_ADDRESS = ENV_VARS.VITE_PUBLIC_TEMPLE_DEVOTION_ADDRESS;

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

/* TODO: When to show Growth Image see => https://github.com/TempleDAO/dapp/issues/258 */
const DevotionCTA = () => {
  const { signer } = useWallet();
  const [devotionActive, setDevotionActive] = useState(false);

  const getStatus = async (signer: JsonRpcSigner) => {
    const DEVOTION = new Devotion__factory()
      .attach(TEMPLE_DEVOTION_ADDRESS)
      .connect(signer);
    const devotionRound = await DEVOTION.currentRound();
    const roundStatus = await DEVOTION.roundStatus(devotionRound);

    // After devotion is started for the first time `currentRound` will be 1
    setDevotionActive(roundStatus.stage !== 2 && devotionRound !== 0);
  };

  useEffect(() => {
    if (signer) getStatus(signer);
  }, [signer]);

  return (
    <>
      {devotionActive ? (
        <Container>
          <Image src={devotionImage} width={60} height={60} />
        </Container>
      ) : null}
    </>
  );
};

export default DevotionCTA;
