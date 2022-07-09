import { useState, useEffect } from 'react';
import { formatDuration, intervalToDuration } from 'date-fns';

import { Pool } from 'components/Layouts/Auction/types';

const getRemainingTime = (pool?: Pool) => {
  const weights = pool?.weightUpdates || [];
  const lastUpdate = weights[weights.length - 1];
  const startTime = lastUpdate ? lastUpdate.startTimestamp : null;
  const now = Date.now();

  if (!startTime || now >= startTime.getTime()) {
    return '';
  }

  const duration = intervalToDuration({
    start: now,
    end: startTime,
  });

  return formatDuration(duration, {
    format: ['months', 'weeks', 'days', 'hours', 'seconds'],
  });
};


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