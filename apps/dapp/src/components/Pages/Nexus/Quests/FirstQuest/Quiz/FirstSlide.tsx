import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import Slide from './Slide';

type FirstSlideProps = {
  startButtonClickHandler: () => void;
};

const FirstSlide = ({ startButtonClickHandler }: FirstSlideProps) => {
  return (
    <Slide headerText={"Start Quiz"}>
        <TextContainer>
          Templar, you’ve made it this far. <br />
          Your journey has only just begun through the hallways of Temple. <br />
          The Library is but the first step in a lifetime of learning. <br />
          But first, answer these riddles so we know you truly are one of us. <br />
          The Temple rewards its Scholars.
        </TextContainer>
        <SlideStartButton playClickSound onClick={startButtonClickHandler}>Start</SlideStartButton>
    </Slide>
  );
};

const TextContainer = styled.div`
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 4rem;
  width: 1056px;
  text-align: center;
  line-height: 40px;
  margin-top: 200px;
  background: radial-gradient(58.56% 58.56% at 50% 49.88%, rgba(193, 177, 177, 0.12) 38.54%, rgba(193, 177, 177, 0) 100%);
  font-size: 20px;
`;

const SlideStartButton = styled(Button)`
  width: 174px;
  height: 61px;
  background: linear-gradient(180deg, #504f4f 45.31%, #0c0b0b 100%);
  border: 1px solid #BD7B4F;
  border-radius: 25px;
  color: #ffffff;
  margin-top: 80px;
  margin-bottom: 20px;
  
  &:hover {
    border: 1px solid;
    border-image-source: linear-gradient(0deg, #FFDEC9, #FFDEC9), linear-gradient(0deg, #D9A37D, #D9A37D);
  }
`;

export default FirstSlide;
