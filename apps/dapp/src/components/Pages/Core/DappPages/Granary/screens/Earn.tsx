import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { auctionName, fillPct, fmt, fmtLeft, fmtPrice } from '../data/derive';
import {
  useMyPositions,
  useNow,
  useStaking,
  useWalletBalance,
} from '../data/hooks';
import {
  Big,
  Btn,
  Card,
  clickable,
  H4,
  K,
  ListRow,
  Mk,
  Moon,
  Note,
  Price,
  Row,
  Stack,
  TextLink,
  V,
} from '../ui';
import { paths } from '../paths';
import { stateText, useRunning, WishFooter } from './common';

const RANK = { Deposit: 0, Scheduled: 1, Fulfillment: 2 } as Record<
  string,
  number
>;

export const Earn = () => {
  const now = useNow();
  const navigate = useNavigate();
  const tgld = useWalletBalance('TGLD').data;
  const staking = useStaking().data;
  const positions = useMyPositions().data;
  // TODO(granary-subgraph): also filter on tgldAuthorized (TempleGold's
  // ContractAuthorizationSet for the auction), indexed per auction (spec §7.4).
  const rows = useRunning()
    .filter(({ a }) => a.bidToken === 'TGLD')
    .sort((x, y) => RANK[x.p] - RANK[y.p]);
  const mine = (id: string) =>
    positions.find((p) => p.auction === id && p.deposit > 0)?.deposit;
  const inAuctions = rows.filter(({ a }) => mine(a.id));

  return (
    <Stack>
      <Row>
        <div>
          <K>Earn Temple Gold</K>
          <Big>Your Temple Gold</Big>
        </div>
        <Bal>
          <Big>{fmt(tgld)} TGLD</Big>
          <Note>
            in your wallet
            {inAuctions.map(
              ({ a }) => ` · ${fmt(mine(a.id) ?? 0)} more in ${auctionName(a)}`
            )}
          </Note>
        </Bal>
      </Row>
      <Card>
        <H4>Staking</H4>
        <Row>
          <K>Staked</K>
          <V>{fmt(staking?.staked ?? 0)} TEMPLE</V>
        </Row>
        <Row>
          <K>Rewards ready</K>
          <V>{fmt(staking?.rewards ?? 0)} TGLD</V>
        </Row>
        <Row $start>
          <Btn $ghost onClick={() => navigate(paths.staking)}>
            Manage staking
          </Btn>
        </Row>
      </Card>
      <Card $hot>
        <Row>
          <H4>Use your Temple Gold</H4>
          <TextLink to={paths.auctions()}>All auctions</TextLink>
        </Row>
        <div>
          {rows.map(({ a, p }) => (
            <ListRow
              key={a.id}
              {...clickable(() => navigate(paths.auction(a)))}
            >
              <Moon phase={p} size={26} paused={a.paused} />
              <div>
                <Mk>{auctionName(a)}</Mk>
                <Note>
                  {p === 'Fulfillment'
                    ? 'Fulfillment · closed to deposits'
                    : stateText(a, now)}
                </Note>
              </div>
              <Note>
                {mine(a.id)
                  ? `You have ${fmt(mine(a.id) ?? 0)} in it`
                  : p === 'Scheduled'
                  ? `in ${fmtLeft(now, a.depositStart)}`
                  : p === 'Fulfillment'
                  ? `Treasury funding ${fillPct(a)}%`
                  : `closes in ${fmtLeft(now, a.depositEnd)}`}
              </Note>
              <Price>{fmtPrice(a.price)}</Price>
            </ListRow>
          ))}
        </div>
        <WishFooter text="Want to swap TGLD for something with no auction?" />
      </Card>
    </Stack>
  );
};

const Bal = styled.div`
  text-align: right;
`;
