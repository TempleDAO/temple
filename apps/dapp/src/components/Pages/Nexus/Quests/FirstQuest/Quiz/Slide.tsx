import styled from 'styled-components';
import Image from 'components/Image/Image';
import borderFrame from 'assets/images/nexus/Border_Frame.svg';
import headerImage from 'assets/images/nexus/KitKat.png';
import temple256 from 'assets/images/nexus/temple256.png';
import { backgroundImage } from 'styles/mixins';

type SlideProps = {
  headerText: string;
};

const Slide: React.FC<SlideProps> = ({ headerText, children }) => {
  return (
    <SlideContainer>
      <SlideHeader>
        <SlideHeaderLogoContainer>
          <Image src={temple256} />
        </SlideHeaderLogoContainer>
        <SlideHeaderTextContainer>{headerText}</SlideHeaderTextContainer>
      </SlideHeader>
      <SlideSeparator />
      <SlideContent>{children}</SlideContent>
    </SlideContainer>
  );
};

const SlideSeparator = styled.hr`
  width: 1266px;
  border: 1px solid #bd7b4f;
`;

const SlideHeaderLogoContainer = styled.div`
  align-items: left;
  width: 100%;
  padding-top: 10px;
  padding-left: 10px;
`;

const SlideHeaderTextContainer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: flex-end;
  width: 100%;
  padding: 10px;
  margin-right: 50px;
  font-size: 24px;
`;

const SlideContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const SlideHeader = styled.div`
  display: flex;
  ${backgroundImage(headerImage, { size: 'cover' })}
  width: 1400px;
`;

const SlideContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 1400px;
  ${backgroundImage(borderFrame, { size: 'cover' })}
  height: 876px;
`;

export default Slide;
