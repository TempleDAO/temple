import styled from 'styled-components';
import { Button } from 'components/Button/Button';
import Slide from './Slide';
import { Link } from 'react-router-dom';

const SuccessSlide = () => {
  return (
    <Slide headerText={''}>
      <TextContainer>
        YOU MUST BE WEARY, TEMPLAR.
        <br />
        THIS QUEST HAS ENDED. <br />
        RETURN TO THE NEXUS <br />
        TO REST FROM YOUR PILGRIMAGE.
      </TextContainer>
      <Link to={'/nexus'}>
        <ReturnToNexusButton playClickSound>RETURN TO THE NEXUS</ReturnToNexusButton>
      </Link>
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
  background: radial-gradient(
    58.56% 58.56% at 50% 49.88%,
    rgba(193, 177, 177, 0.12) 38.54%,
    rgba(193, 177, 177, 0) 100%
  );
  font-size: 20px;
`;

const ReturnToNexusButton = styled(Button)`
  width: 400px;
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

export default SuccessSlide;
