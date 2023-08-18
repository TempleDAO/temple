import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import Slide from './Slide';

type FinalSlideProps = {
  backButtonClickHandler: () => void;
  submitButtonClickHandler: () => void;
};
const FinalSlide = ({ backButtonClickHandler, submitButtonClickHandler }: FinalSlideProps) => {
  return (
    <Slide headerText={'End Quiz'}>
      <TextContainer>
        YOU HAVE REACHED THE END OF THE QUIZ. <br />
        CLICK SUBMIT TO FINALISE YOUR SCORE.
        <br />
        GO BACK IF YOU ARE NOT READY TO ASCEND. <br />
      </TextContainer>
      <ButtonsContainer>
        <StyledButton playClickSound onClick={backButtonClickHandler}>BACK</StyledButton>
        <StyledButton playClickSound onClick={submitButtonClickHandler}>SUBMIT</StyledButton>
      </ButtonsContainer>
    </Slide>
  );
};

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
  width: 174px;
  height: 61px;
  background: linear-gradient(180deg, #504f4f 45.31%, #0c0b0b 100%);
  border: 1px solid #bd7b4f;
  border-radius: 25px;
  color: #ffffff;
  margin-right: 20px;
  margin-top: 80px;
  margin-bottom: 20px;

  &:hover {
    border: 1px solid;
    border-image-source: linear-gradient(0deg, #ffdec9, #ffdec9), linear-gradient(0deg, #d9a37d, #d9a37d);
  }
`;

export default FinalSlide;
