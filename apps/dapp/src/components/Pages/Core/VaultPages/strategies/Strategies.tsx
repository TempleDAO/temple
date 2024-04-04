/* eslint-disable react/no-unescaped-entities */
import styled from 'styled-components';

const StrategyContainer = styled.div`
  color: #ffdec9;
  font-size: 1.5rem;
  margin: 1.875rem 1.25rem 0rem 1.25rem;
  height: 18.75rem;
  text-align: left;
  padding: 0.625rem;
  overflow-x: hidden;
  overflow-y: scroll;
`;

const Section = styled.div`
  font-weight: 600;
`;

const P = styled.div`
  font-size: inherit;
`;

export const strategies: Record<string, JSX.Element> = {
  'tst-30min': (
    <StrategyContainer>
      <P>
        <Section>Primary</Section>
        <ul>
          <li>FRAX3CRV leveraged farming on Convex</li>
          <li>cvxCRV/CRV LP farming on Convex</li>
        </ul>
      </P>
      <P>
        <Section>Secondary</Section>
        <ul>
          <li>FRAX/TEMPLE gauge farming on STAX</li>
        </ul>
      </P>
      <P>
        <Section>Bonuses</Section>
        <ul>
          <li>Auto-compounding for long term stakers</li>
          <li>veFXS bribes</li>
          <li>Boosted yield through max-locking veFXS</li>
        </ul>
      </P>
    </StrategyContainer>
  ),
  'temple-1m-vault': (
    <StrategyContainer>
      <P>
        <Section>Primary</Section>
        <ul>
          <li>Internal test vault</li>
          <li>Fake strategy</li>
        </ul>
      </P>
      <P>
        <Section>Secondary</Section>
        <ul>
          <li>Nothing to see here</li>
          <li>Except testing scroll and long text wrapping</li>
        </ul>
      </P>
      <P>
        <Section>Bonus</Section>
        <ul>
          <li>There is a bonus applied sometimes, but not always</li>
          <li>
            The bonus is sometimes applied, but every now and then, it's not
          </li>
        </ul>
      </P>
    </StrategyContainer>
  ),
  '1m-core': (
    <StrategyContainer>
      <P>
        <Section>Primary</Section>
        <ul>
          <li>FRAX3CRV leveraged farming on Convex</li>
          <li>cvxCRV/CRV LP farming on Convex</li>
        </ul>
      </P>
      <P>
        <Section>Secondary</Section>
        <ul>
          <li>FRAX/TEMPLE gauge farming on STAX</li>
        </ul>
      </P>
      <P>
        <Section>Bonuses</Section>
        <ul>
          <li>Auto-compounding for long term stakers</li>
          <li>veFXS bribes</li>
          <li>Boosted yield through max-locking veFXS</li>
        </ul>
      </P>
    </StrategyContainer>
  ),
};

export const DefaultText = (
  <StrategyContainer>
    <P>Strategy not found for this vault name</P>
  </StrategyContainer>
);
