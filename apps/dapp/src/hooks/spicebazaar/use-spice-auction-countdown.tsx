import { useState, useEffect, useCallback, useRef } from 'react';
import { SpiceAuctionInfo } from 'providers/SpiceAuctionProvider';
import { AuctionState, getAuctionState } from 'utils/spice-auction-state';

export interface CountdownResult {
  countdown: string;
  state: AuctionState;
  endDate: Date | null;
}

export const useSpiceAuctionCountdown = (
  spiceAuctionInfo: SpiceAuctionInfo | null
): CountdownResult => {
  const [result, setResult] = useState<CountdownResult>({
    countdown: '',
    state: AuctionState.NOT_SCHEDULED,
    endDate: null,
  });
  const timerRef = useRef<NodeJS.Timeout>();

  const calculateTimeLeft = useCallback((endTime: number) => {
    const difference = endTime - Date.now();

    if (difference <= 0) {
      return '';
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / 1000 / 60) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, []);

  const calculateResult = useCallback((): CountdownResult => {
    if (!spiceAuctionInfo) {
      return {
        countdown: '',
        state: AuctionState.NOT_SCHEDULED,
        endDate: null,
      };
    }

    const state = getAuctionState(spiceAuctionInfo);
    const now = Date.now();

    switch (state) {
      case AuctionState.LIVE: {
        // Countdown to end time
        const countdown = calculateTimeLeft(spiceAuctionInfo.auctionEndTime);
        return {
          countdown,
          state,
          endDate: new Date(spiceAuctionInfo.auctionEndTime),
        };
      }
      case AuctionState.SCHEDULED: {
        // Countdown to start time
        const countdown = calculateTimeLeft(spiceAuctionInfo.auctionStartTime);
        return {
          countdown,
          state,
          endDate: null,
        };
      }
      case AuctionState.ENDED: {
        // No countdown, but provide end date
        return {
          countdown: '',
          state,
          endDate: new Date(spiceAuctionInfo.auctionEndTime),
        };
      }
      case AuctionState.NOT_SCHEDULED:
      default: {
        return {
          countdown: 'TBD',
          state,
          endDate: null,
        };
      }
    }
  }, [spiceAuctionInfo, calculateTimeLeft]);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Calculate initial result
    setResult(calculateResult());

    // Set up interval for updates (only if we need countdown)
    const state = getAuctionState(spiceAuctionInfo);
    if (state === AuctionState.LIVE || state === AuctionState.SCHEDULED) {
      timerRef.current = setInterval(() => {
        setResult(calculateResult());
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [spiceAuctionInfo, calculateResult]);

  return result;
};
