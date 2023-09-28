import { useState } from 'react';
import styled from 'styled-components';
import ClaimFromVaults from './Legacy/ClaimFromVaults';
import UnstakeOGT from './Legacy/UnstakeOGT';

export const LegacyPage = () => {
  const [showUnstakeOGT, setShowUnstakeOGT] = useState<boolean>(false);

  return (
    <LegacyContainer>
      <LegacyHeader>
        <LegacyLinkCell selected={!showUnstakeOGT} onClick={() => setShowUnstakeOGT(false)}>Claim From Vaults</LegacyLinkCell>
        <LegacyLinkCell selected={!!showUnstakeOGT} onClick={() => setShowUnstakeOGT(true)}>Unlock OGT</LegacyLinkCell>
      </LegacyHeader>
      <LegacySeparator />
      <LegacyContent>{showUnstakeOGT ? <UnstakeOGT /> : <ClaimFromVaults />}</LegacyContent>
    </LegacyContainer>
  );
};

const LegacySeparator = styled.div`
  height: 4rem;
`;

type LegacyLinkCellProps = {
  selected: boolean;
}

const LegacyLinkCell = styled.div<LegacyLinkCellProps>`
  margin-left: 40px;
  cursor: pointer;
  color: ${({ theme }) => theme.palette.brand};
  font-weight: ${({ selected }) => selected ? 'bold' : 'normal'};
  text-decoration: ${({ selected }) => selected ? 'underline' : 'none'};
`;

const LegacyContent = styled.div`
  display: flex;
`;

const LegacyContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const LegacyHeader = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: left;
  margin-top: 10px;
`;
