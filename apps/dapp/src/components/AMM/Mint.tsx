import React, { FC, useEffect, useState, useCallback } from 'react';
import { ConvoFlowTitle, Spacer, SwapArrows, TitleWrapper, ViewContainer } from 'components/AMM/helpers/components';
import { Button } from 'components/Button/Button';

interface MintProps {
    small?: boolean;
  }

export const Mint: FC<MintProps> = ({ small }) => {

    return (
        <ViewContainer>
          <TitleWrapper>
            <ConvoFlowTitle>{small ? 'Mint' : 'MINT NEXUS PASSPORT RELIC'}</ConvoFlowTitle>
          </TitleWrapper>
          <Spacer small={small} />
          <Button
            label={
              'mint'
            }
            isUppercase
            isSmall={small}
            onClick={() => alert('Not yet implemented friend. Go to apps/dapp/src/components/AMM/Mint.tsx line 23')}
          />
        </ViewContainer>
      );
}