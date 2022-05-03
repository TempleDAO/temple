import { ReactElement, JSXElementConstructor } from 'react';

import Tippy from '@tippyjs/react';
import { roundArrow } from 'tippy.js';
import { format, addSeconds } from 'date-fns';

import { Entry, Vault } from 'components/Vault/types';
import { TippyDiv } from 'components/Tooltip/Tooltip';
import { SECONDS_IN_MONTH } from './desktop-parts/utils';

type Props = {
  vault: Vault;
  entry: Entry;
  // Tippy has weird typing for children.
  children: ReactElement<any, string | JSXElementConstructor<any>>;
};

const TimelineTippy = ({ vault, entry, children }: Props) => {
  if (!entry.entryDate) {
    return null;
  }
  
  const amount = entry.amount;
  const startDate = format(entry.entryDate, 'MMM do');
  const endDate = format(
    addSeconds(entry.entryDate!, SECONDS_IN_MONTH * vault.months),
    'MMM do'
  );

  return (
    <Tippy
      content={
        <TippyDiv>
          {amount} $TEMPLE<br />
          Vesting Date: {endDate}
        </TippyDiv>
      } 
      animation="scale-subtle"
      duration={250}
      arrow={roundArrow}
      trigger="click"
    >
      {children}
    </Tippy>
  );
}

export default TimelineTippy;
