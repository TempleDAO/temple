import { Route, Routes } from 'react-router-dom';
import styled from 'styled-components';

import BaseImage from 'components/Image/Image';
import { useWatchAsset, TEMPLE_ASSET } from 'hooks/use-watch-asset';
import { Trade } from './views/Trade';
import { Unstake } from './views/Unstake';
import { Stake } from './views/Stake';
import { PageWrapper } from '../utils';
import { Container } from './styles';
import { tabletAndAbove } from 'styles/breakpoints';
import { buttonResets } from 'styles/mixins';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';
import { PillMenu } from 'components/PillMenu';

const TradeRoutes = () => {
  const [watchAsset] = useWatchAsset(TEMPLE_ASSET);
 
  return (
    <>
      <PageWrapper>
        <Container>
          <div>
            <MenuWrapper>
              <PillMenu
                links={[{
                  to: '/dapp/trade',
                  label: 'Trade',
                }, {
                  to: '/dapp/trade/stake',
                  label: 'Stake',
                }, {
                  to: '/dapp/trade/unstake',
                  label: 'Unstake',
                }]}
              />
            </MenuWrapper>
            <Wrapper>
              <Routes>
                <Route path="/" element={<Trade />} />
                <Route path="/unstake" element={<Unstake />} />
                <Route path="/stake" element={<Stake />} />
              </Routes>
            </Wrapper>
            {watchAsset && (
               <AddTokenButton type="button" onClick={watchAsset}>
                <Image
                  src={TEMPLE_ASSET.image}
                  width={24}
                  height={24}
                  alt={`Add ${TEMPLE_ASSET.symbol}`}
                  title={`Register ${TEMPLE_ASSET.symbol}`}
                />
                Add {TICKER_SYMBOL.TEMPLE_TOKEN} To Wallet
              </AddTokenButton>
            )}
          </div>
        </Container>
      </PageWrapper>
    </>
  );
};

const Wrapper = styled.div`
  ${tabletAndAbove(`
    padding: 1.5rem 2rem 2.5rem;
    border-radius: 2rem;
    box-shadow: 0 0 5rem #1D1A1A;
    max-width: 40rem;
  `)}
`;

const AddTokenButton = styled.button`
  ${buttonResets}
  background: transparent;
  color: ${({ theme }) => theme.palette.brand};
  display: flex;
  align-items: center;
  margin: 1rem auto;
`;

const Image = styled(BaseImage)`
  margin-right: 0.25rem;
`;

const MenuWrapper = styled.div`
  width: 100%;
  max-width: 40rem;
  margin: 0 auto 1.5rem;
`;

export default TradeRoutes;