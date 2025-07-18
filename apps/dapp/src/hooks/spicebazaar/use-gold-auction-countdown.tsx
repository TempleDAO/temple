import { useState, useEffect, useCallback } from 'react';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';

export const useGoldAuctionCountdown = () => {
  const [countdown, setCountdown] = useState<string>('');

  const {
    daiGoldAuctionInfo: { data: daiGoldAuctionInfo },
  } = useSpiceBazaar();

  const calculateTimeLeft = useCallback(
    (endTime: number) => {
      const difference = endTime - Date.now();

      if (difference <= 0) {
        return daiGoldAuctionInfo?.currentEpochAuctionLive
          ? '0d 0h 0m 0s'
          : 'Starts soon';
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    },
    [daiGoldAuctionInfo?.currentEpochAuctionLive]
  );

  useEffect(() => {
    if (!daiGoldAuctionInfo?.auctionEndTime) return;

    // special case only for the first epoch
    if (
      daiGoldAuctionInfo.currentEpoch === 1 &&
      daiGoldAuctionInfo.auctionEndTime > Date.now()
    ) {
      setCountdown(calculateTimeLeft(daiGoldAuctionInfo.auctionEndTime));
    } else {
      const targetTime = daiGoldAuctionInfo.currentEpochAuctionLive
        ? daiGoldAuctionInfo.auctionEndTime
        : daiGoldAuctionInfo.auctionEndTime +
          daiGoldAuctionInfo.auctionDuration;
      setCountdown(calculateTimeLeft(targetTime));
    }

    const timer = setInterval(() => {
      const targetTime = daiGoldAuctionInfo.currentEpochAuctionLive
        ? daiGoldAuctionInfo.auctionEndTime
        : daiGoldAuctionInfo.auctionEndTime +
          daiGoldAuctionInfo.auctionDuration;
      setCountdown(calculateTimeLeft(targetTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [daiGoldAuctionInfo, calculateTimeLeft]);

  return countdown;
};
