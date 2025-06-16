import { useState, useEffect, useCallback, useRef } from 'react';
import { SpiceAuctionInfo } from 'providers/SpiceAuctionProvider';

export const useSpiceAuctionCountdown = (
  spiceAuctionInfo: SpiceAuctionInfo | null
) => {
  const [countdown, setCountdown] = useState<string>('');
  const timerRef = useRef<NodeJS.Timeout>();

  const calculateTimeLeft = useCallback((endTime: number) => {
    const difference = endTime - Date.now();

    // if end date is the past, show TBD
    if (endTime < Date.now()) {
      return 'TBD';
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / 1000 / 60) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  }, []);

  useEffect(() => {
    if (!spiceAuctionInfo?.auctionEndTime) {
      setCountdown('');
      return;
    }

    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // TODO: Simplify: Countdown to start time if in the future
    // OR else countdown to end time if it's started.
    // If the auction ended, then show "Starts in TBD"

    const targetTime =
      spiceAuctionInfo.auctionStartTime > Date.now()
        ? spiceAuctionInfo.auctionStartTime // countdown to start time if it is in the future, meaning auction is about to start
        : spiceAuctionInfo.auctionEndTime; // otherwise is end time.

    // // Calculate initial countdown
    // // either the start time in the future
    // // or end time in the future
    // const targetTime = spiceAuctionInfo.currentEpochAuctionLive
    //   ? spiceAuctionInfo.auctionEndTime
    //   : spiceAuctionInfo.auctionEndTime + spiceAuctionInfo.auctionDuration;
    //   // Note typically the auction duration is 0
    //   // So we just end up showing "TBD" or starts soon

    setCountdown(calculateTimeLeft(targetTime));

    // Set up interval for updates
    timerRef.current = setInterval(() => {
      const targetTime =
        spiceAuctionInfo.auctionStartTime > Date.now()
          ? spiceAuctionInfo.auctionStartTime // countdown to start time if it is in the future, meaning auction is about to start
          : spiceAuctionInfo.auctionEndTime; // otherwise is end time.
      setCountdown(calculateTimeLeft(targetTime));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [spiceAuctionInfo, calculateTimeLeft]);

  return countdown;
};
