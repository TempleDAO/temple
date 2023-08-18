import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import Image from 'components/Image/Image';
import Slide from './Slide';
import nexusCloseBook from 'assets/images/nexus/Shard1b.png';
import { useRelic } from 'providers/RelicProvider';

type CollectSlideProps = {
  passed: boolean;
  tryAgainButtonClickHandler?: () => void;
  onSuccessCallback?: (() => Promise<void>) | (() => void);
};

const CollectSlide = ({ passed, tryAgainButtonClickHandler, onSuccessCallback }: CollectSlideProps) => {
  const { mintShard } = useRelic();
  const { handler: mintShardHandler, isLoading: mintShardLoading, error: mintShardError } = mintShard;

  const collectShardHandler = async () => {
    console.debug('Going to mint shard');
    await mintShardHandler();
    if (onSuccessCallback) {
      onSuccessCallback();
    }
  };

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
    <Slide headerText={''}>
      {passed && (
        <>
          <TextContainer>
            <CollectShardContainer>
              TEMPLAR, YOU ARE DESERVING. <br />
              AS A SCHOLAR OF THE TEMPLE, <br />
              YOU ARE REWARDED FOR YOUR PERSEVERANCE IN <br />
              THE QUEST FOR KNOWLEDGE.
              <ImageContainer>
                <Image width={100} src={nexusCloseBook} />
              </ImageContainer>
            </CollectShardContainer>
          </TextContainer>
          <ButtonsContainer>
            <StyledButton loading={mintShardLoading} onClick={collectShardHandler}>
              COLLECT SHARD
            </StyledButton>
          </ButtonsContainer>
          {mintShardError && (
            <ErrorContainer>
              {friendlyErrorMessage(mintShardError)}
            </ErrorContainer>
          )}
        </>
      )}
      {!passed && (
        <>
          <TextContainer>
            TEMPLAR, YOU ARE ARE NOT READY. <br />
            FRET NOT, ALL ARE GIVEN ANOTHER CHANCE <br />
            TO PROVE THEY ARE DESERVING. <br />
            GO BACK AND TRY AGAIN. <br />
          </TextContainer>
          <ButtonsContainer>
            <StyledButton playClickSound onClick={tryAgainButtonClickHandler}>TRY AGAIN</StyledButton>
          </ButtonsContainer>
        </>
      )}
    </Slide>
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
  margin-top: 10px;
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
  padding: 4rem;
  width: 1056px;
  text-align: center;
  line-height: 40px;
  margin-top: 200px;
  background: radial-gradient(
    58.56% 58.56% at 50% 49.88%,
    rgba(193, 177, 177, 0.12) 38.54%,
    rgba(193, 177, 177, 0) 100%
  );
  font-size: 20px;
`;

const StyledButton = styled(Button)`
  width: 224px;
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

export default CollectSlide;
