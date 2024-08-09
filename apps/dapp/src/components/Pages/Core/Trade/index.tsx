import { FC, ReactNode } from 'react';
import {
  Route,
  Routes,
  Link as BaseLink,
  useResolvedPath,
  useMatch,
  Navigate,
} from 'react-router-dom';
import styled from 'styled-components';

import BaseImage from 'components/Image/Image';
// import { useWatchAsset, TEMPLE_ASSET } from 'hooks/use-watch-asset';
import { Unstake } from './views/Unstake';
import { PageWrapper } from '../utils';
import { Container } from './styles';
import { tabletAndAbove } from 'styles/breakpoints';
import { buttonResets } from 'styles/mixins';
import { TICKER_SYMBOL } from 'enums/ticker-symbol';

const TradeRoutes = () => {
  // TODO: This is commented out because of the wagmi replacement
  // We can probably remove the file entirely if we don't need it anymore
  // const [watchAsset] = useWatchAsset(TEMPLE_ASSET);

  return (
    <>
      <PageWrapper>
        <Container>
          <div>
            <MenuWrapper>
              <Menu>
                <TradeLink to="/dapp/trade">Trade</TradeLink>
                <TradeLink to="/dapp/trade/unstake">Unstake</TradeLink>
              </Menu>
            </MenuWrapper>
            <Wrapper>
              <Routes>
                <Route path="/unstake" element={<Unstake />} />
                <Route path="/*" element={<Navigate to=".." replace />} />
              </Routes>
            </Wrapper>
            {/* {watchAsset && (
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
            )} */}
          </div>
        </Container>
      </PageWrapper>
    </>
  );
};

const TradeLink: FC<{ children: ReactNode; to: string }> = (props) => {
  const resolved = useResolvedPath(props.to);
  const match = useMatch({ path: resolved.pathname, end: true });
  return <Link {...props} $isActive={!!match} />;
};

const Wrapper = styled.div`
  ${tabletAndAbove(`
    padding: 1.5rem 2rem 2.5rem;
    border-radius: 2rem;
    box-shadow: 0 0 5rem #1D1A1A;
    max-width: 40rem;
  `)}
`;

const MenuWrapper = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  width: 100%;
  max-width: 40rem;
  margin: 0 auto 1.5rem;
  justify-content: space-between;
`;

const Menu = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
`;

const Link = styled(BaseLink)<{ $isActive: boolean }>`
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  display: block;
  background: ${({ $isActive, theme }) =>
    $isActive ? '#1D1A1A' : 'transparent'};
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

export default TradeRoutes;
