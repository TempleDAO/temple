import styled from 'styled-components';
import { Account } from 'components/Layouts/CoreLayout/Account';
import PotSlide from './PotSlide';

const PotConnectWalletSlide = () => {
  return (
    <PotSlide headerText={''}>
      <Container>
        Connect wallet to continue
        <br /><br />
        <ConnectButtonWrapper>
          <Account />
        </ConnectButtonWrapper>
      </Container>
    </PotSlide>
  );
};

const ConnectButtonWrapper = styled.div`
  width: 300px;
  margin: auto;
`;

const Container = styled.div`
  border: 0.0625rem solid ${(props) => props.color ?? props.theme.palette.brand};
  border-radius: 16px;
  padding: 4rem;
  width: 1056px;
  text-align: center;
  line-height: 40px;
  margin-top: 200px;
  font-size: 20px;
`;

export default PotConnectWalletSlide;
