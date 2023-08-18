import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import Image from 'components/Image/Image';
import { useRelic } from 'providers/RelicProvider';
import PotSlide from './PotSlide';

import ChaosShard from 'assets/images/nexus/ChaosShard.png';
import MysteryShard from 'assets/images/nexus/MysteryShard.png';
import LogicShard from 'assets/images/nexus/LogicShard.png';
import OrderShard from 'assets/images/nexus/OrderShard.png';
import StructureShard from 'assets/images/nexus/StructureShard.png';

type PotCollectSlideProps = {
  onSuccessCallback?: (() => Promise<void>) | (() => void);
  enclave: string;
};

const PotCollectSlide = ({ onSuccessCallback, enclave }: PotCollectSlideProps) => {
  const { mintPathOfTemplarShard } = useRelic();
  const { handler: mintShardHandler, isLoading: mintShardLoading, error: mintShardError } = mintPathOfTemplarShard;

  // uint256[] public SHARD_ID = [2, 3, 4, 5, 6];
  // string[] public ENCLAVE = [
  //     "",
  //     "chaosEnclave", 2
  //     "mysteryEnclave", 3
  //     "logicEnclave", 4
  //     "structureEnclave", 5
  //     "orderEnclave" 6
  // ];

  let shardImage = ChaosShard;
  let shardIndex = 2;
  let buttonText = 'Mint the Enclave of Chaos Shard';
  if (enclave === 'mystery') {
    shardImage = MysteryShard;
    shardIndex = 3;
    buttonText = 'Mint the Enclave of Mystery Shard';
  } else if (enclave === 'logic') {
    shardImage = LogicShard;
    shardIndex = 4;
    buttonText = 'Mint the Enclave of Logic Shard';
  } else if (enclave === 'order') {
    shardImage = OrderShard;
    shardIndex = 6;
    buttonText = 'Mint the Enclave of Order Shard';
  } else if (enclave === 'structure') {
    shardImage = StructureShard;
    shardIndex = 5;
    buttonText = 'Mint the Enclave of Structure Shard';
  }

  const collectShardHandler = async () => {
    console.debug('Going to mint shard');
    await mintShardHandler(shardIndex);
    if (onSuccessCallback) {
      onSuccessCallback();
    }
  };

  // TODO: move this to some common shared utils
  const friendlyErrorMessage = (maybeError: any) => {
    let message = '';
    if (maybeError.message) {
      const boundary = maybeError.message.indexOf('(');
      if (boundary > 0) {
        message = maybeError.message.substring(0, boundary - 1);
      } else {
        maybeError.message.substring(0, 20).concat('...');
      }
    }

    if (maybeError.reason) {
      message = maybeError.reason;
    }
    return message;
  };
  return (
    <PotSlide headerText={''}>
      <TextContainer>
        <CollectShardContainer>
          Welcome, Templar.
          <br />
          Your pathway through the Temple Gates has only <br />
          just begun. <br />
          Seek out your own destiny. <br />
          May the Temple Sun always shine upon you.
          <ImageContainer>
            <Image width={100} src={shardImage} />
          </ImageContainer>
        </CollectShardContainer>
      </TextContainer>
      <ButtonsContainer>
        <StyledButton loading={mintShardLoading} onClick={collectShardHandler}>
          {buttonText}
        </StyledButton>
      </ButtonsContainer>
      {mintShardError && <ErrorContainer>{friendlyErrorMessage(mintShardError)}</ErrorContainer>}
    </PotSlide>
  );
};

const ErrorContainer = styled.div`
  color: red;
`;

const ImageContainer = styled.div`
  border: 2px solid;
  border-radius: 10px;
  display: flex;
  padding: 10px;
  align-items: center;
  margin-top: 30px;
  border: 1.5px solid #bd7b4f;
  border-radius: 10px;
`;

const CollectShardContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`;

const ButtonsContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const TextContainer = styled.div`
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 3rem;
  width: 1056px;
  text-align: center;
  line-height: 25px;
  margin-top: 200px;
  background: radial-gradient(
    58.56% 58.56% at 50% 49.88%,
    rgba(193, 177, 177, 0.12) 38.54%,
    rgba(193, 177, 177, 0) 100%
  );
  font-size: 20px;
`;

const StyledButton = styled(Button)`
  width: 600px;
  height: 61px;
  background: linear-gradient(180deg, #504f4f 45.31%, #0c0b0b 100%);
  border: 1px solid #bd7b4f;
  border-radius: 25px;
  color: #ffffff;
  margin-top: 80px;
  margin-bottom: 20px;

  &:hover {
    border: 1px solid;
    border-image-source: linear-gradient(0deg, #ffdec9, #ffdec9), linear-gradient(0deg, #d9a37d, #d9a37d);
  }
`;

export default PotCollectSlide;
