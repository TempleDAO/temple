import { ReactElement, JSXElementConstructor } from 'react';

import Tippy from '@tippyjs/react';
import { roundArrow } from 'tippy.js';
import { format, isDate } from 'date-fns';

import { Marker } from 'components/Vault/types';
import { TippyDiv } from 'components/Tooltip/Tooltip';

type Props = {
  marker: Marker;
  // Tippy has weird typing for children.
  children: ReactElement<any, string | JSXElementConstructor<any>>;
};

const TimelineTippy = ({ marker, children }: Props) => {
  const amount = marker.amount;
  const unlockValue = isDate(marker.unlockDate) ? format(marker.unlockDate as Date, 'MMM do') : 'now';

  return (
    <Tippy
      content={
        <TippyDiv>
          {amount} $TEMPLE
          <br />
          Unlock Date: {unlockValue}
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
};

export default TimelineTippy;
