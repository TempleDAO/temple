import { ReactElement, JSXElementConstructor } from 'react';

import Tippy from '@tippyjs/react';
import { roundArrow } from 'tippy.js';
import { format, isDate, formatDistance } from 'date-fns';

import { Marker, MarkerType } from 'components/Vault/types';
import { TippyDiv } from 'components/Tooltip/Tooltip';
import { useVaultBalance } from 'hooks/core/use-vault-balance';
import Loader from 'components/Loader/Loader';
import { fromAtto } from 'utils/bigNumber';
import { formatTemple } from './utils';

type Props = {
  marker: Marker;
  // Tippy has weird typing for children.
  children: ReactElement<any, string | JSXElementConstructor<any>>;
};

const TimelineTippy = ({ marker, children }: Props) => {
  const [{ balance, staked, isLoading }] = useVaultBalance(marker.vaultId);
  const amount = staked || 0;
  const unlockValue = isDate(marker.unlockDate)
    ? format(marker.unlockDate as Date, 'MMM do')
    : 'now';

  let content;

  if (isLoading) {
    content = (
      <TippyDiv>
        <Loader />
      </TippyDiv>
    );
  } else if (marker.type === MarkerType.EMPTY) {
    content = (
      <TippyDiv>
        This empty Marker represents the available window to make a deposit in
        this sub-vault ({marker.label}). This will end in{' '}
        {formatDistance(marker.windowEndDate, Date.now())}
      </TippyDiv>
    );
  } else {
    const unlockString =
      marker.unlockDate === 'NOW'
        ? 'It is unlocked and claimable.'
        : `It will unlock on ${unlockValue}`;
    content = (
      <TippyDiv>
        You have deposited {formatTemple(amount)} $TEMPLE in sub-vault{' '}
        {marker.label}. The $TEMPLE balance is now {formatTemple(balance)}.{' '}
        <br /> {unlockString}
      </TippyDiv>
    );
  }

  return (
    <Tippy
      content={content}
      animation="scale-subtle"
      duration={250}
      arrow={roundArrow}
      trigger="click"
    >
      {children}
    </Tippy>
  );
};

export default TimelineTippy;
