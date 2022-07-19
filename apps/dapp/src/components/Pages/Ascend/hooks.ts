import { useState, useEffect } from 'react';
import { formatDuration, intervalToDuration } from 'date-fns';

import { Pool } from 'components/Layouts/Auction/types';
import { getRemainingTime } from './utils';

export const useTimeRemaining = (pool?: Pool) => {
  const [time, setTime] = useState(getRemainingTime(pool));

  useEffect(() => {
    if (!pool || !time) {
      return;
    }

    const id = setTimeout(() => {
      setTime(getRemainingTime(pool));
    }, 1000);

    return () => {
      clearTimeout(id);
    };
  }, [setTime, pool, time]);

  return time;
};