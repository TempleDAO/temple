import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import linkSvg from 'assets/icons/link.svg?react';
import templeDaoLogo from 'assets/images/temple-dao-logo.svg?react';
import spiceBazaar from 'assets/images/spice-bazaar.svg?react';
import { Button } from 'components/Button/Button';
import spice1 from 'assets/images/spice1.svg?react';
import spice2 from 'assets/images/spice2.svg?react';
import spice3 from 'assets/images/spice3.svg?react';
import spice4 from 'assets/images/spice4.svg?react';
import spice5 from 'assets/images/spice-all-spices.svg?react';
import * as breakpoints from 'styles/breakpoints';
import { useMediaQuery } from 'react-responsive';
import { queryPhone } from 'styles/breakpoints';

export const SpiceBazaarPage = () => {
  const isPhoneOrAbove = useMediaQuery({
    query: queryPhone,
  });
  const navigate = useNavigate();
  return (
    <PageContainer>
      {isPhoneOrAbove && (
        <BackgroundContainer>
          <Spice1 />
          <Spice2 />
          <Spice3 />
          <Spice4 />
          <Spice5 />
        </BackgroundContainer>
      )}
      <MainContainer>
        <LeftContainer>
          <Title>
            Spice Bazaar
            <LinkIcon
              onClick={() =>
                window.open(
                  'https://docs.templedao.link/spice-bazaar',
                  '_blank',
                  'noreferrer'
                )
              }
            />
          </Title>
          {isPhoneOrAbove ? (
            <Text>
              Welcome to the Spice Bazaar, <br />
              a marketplace where you can <br />
              earn Temple Gold and spend <br />
              them to acquire valuable <br />
              tokens from the Treasury. <br />
            </Text>
          ) : (
            <TextMobileContainer>
              <TextMobile>
                Welcome to the Spice Bazaar, <br />
                a marketplace where you can <br />
                earn Temple Gold and spend <br />
                them to acquire valuable <br />
                tokens from the Treasury. <br />
              </TextMobile>
            </TextMobileContainer>
          )}
        </LeftContainer>
        <RightContainer>
          <ButtoonsContainer>
            <TradeButton onClick={() => navigate('earn/staketemple/stake')}>
              EARN TEMPLE GOLD
            </TradeButton>
            <TradeButton onClick={() => navigate('spend')}>
              BID TEMPLE GOLD
            </TradeButton>
          </ButtoonsContainer>
          <BackgroundImage />
          <Logo />
        </RightContainer>
      </MainContainer>
    </PageContainer>
  );
};

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  gap: 60px;
  margin-top: -40px;

  ${breakpoints.phoneAndAbove(`
    margin-bottom: -80px;
    margin-right: -120px;
    margin-left: -120px;
  `)}
`;

const BackgroundContainer = styled.div`
  position: absolute;
  // top: 0;
  // left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  overflow: hidden;
`;

const MainContainer = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 20px;
  z-index: 1;
  overflow: hidden;

  ${breakpoints.phoneAndAbove(`
    flex-direction: row;
    align-self: center;
    width: 1200px;
    height: 706px;
    margin-top: 110px;
    padding: 0px;
    gap: 40px;
  `)}
`;

const LeftContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;

  ${breakpoints.phoneAndAbove(`
    padding: 40px 80px 80px 80px;
  `)}
`;

const Title = styled.h2`
  display: flex;
  align-items: center;
  font-size: 36px;
  font-weight: 400;
  text-align: center;
  line-height: 67px;
  color: ${({ theme }) => theme.palette.brandLight};
  gap: 15px;
  margin: 0px;
`;

const LinkIcon = styled(linkSvg)`
  fill: ${({ theme }) => theme.palette.brand};
  cursor: pointer;
`;

const Text = styled.div`
  font-size: 18px;
  line-height: 22px;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brand};
`;

const TextMobileContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const TextMobile = styled.div`
  font-size: 16px;
  line-height: 19px;
  font-weight: 700;
  color: ${({ theme }) => theme.palette.brand};
`;

const RightContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const BackgroundImage = styled(spiceBazaar)`
  z-index: 2;
  width: 290px;
  height: 300px;
  top: 20%;

  ${breakpoints.phoneAndAbove(`
    width: 682px;
    height: 707px;
  `)}
`;

const Logo = styled(templeDaoLogo)`
  width: 109px;
  height: 104px;
  position: absolute;
  top: 71%;
  transform: translateX(-10px);
  z-index: 3;

  ${breakpoints.phoneAndAbove(`
    top: 22%;
    transform: translateX(-30px);
    width: 180px;
    height: 170px;
  `)}
`;

const ButtoonsContainer = styled.div`
  background: linear-gradient(
    90deg,
    rgba(196, 196, 196, 0) 0.49%,
    rgba(89, 89, 89, 0.48) 50.04%,
    rgba(196, 196, 196, 0) 100%
  );
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 20px;
  margin-bottom: 20px;
  gap: 12px;
  height: 100%;
  width: auto;

  ${breakpoints.phoneAndAbove(`
    padding: 0px 10px 0px 10px;
    position: absolute;
    top: 49%;
    transform: translateX(-25px);
    z-index: 4;
    height: auto;
  `)}
`;

const TradeButton = styled(Button)`
  padding: 10px 20px 10px 20px;
  min-width: 205px;
  width: ${(props) => props.width || 'min-content'};
  height: min-content;
  background: linear-gradient(90deg, #58321a 20%, #95613f 84.5%);
  border: 1px solid ${({ theme }) => theme.palette.brandDark};
  box-shadow: 0px 0px 20px 0px #de5c0666;
  border-radius: 10px;
  font-size: 16px;
  line-height: 20px;
  font-weight: 700;
  text-transform: uppercase;
  color: ${({ theme }) => theme.palette.brandLight};
  whitespace: 'nowrap';
  margin: 0px;
`;

const Spice1 = styled(spice1)`
  position: absolute;
  bottom: 0;
  left: 0;
`;

const Spice2 = styled(spice2)`
  position: absolute;
  bottom: 0;
  left: 17%;
`;

const Spice3 = styled(spice3)`
  position: absolute;
  bottom: 5%;
  left: 13%;
`;

const Spice4 = styled(spice4)`
  position: absolute;
  bottom: 0;
  right: 0px;
`;

const Spice5 = styled(spice5)`
  position: absolute;
  top: 0;
  right: 0;
`;
