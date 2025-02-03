import { useState, useEffect } from 'react';
import { useSpiceBazaar } from 'providers/SpiceBazaarProvider';

type TimeRemaining = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export const useUnstakeTime = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [unstakeTimeRemaining, setUnstakeTimeRemaining] = useState<
    number | null
  >(null);
  const [countdown, setCountdown] = useState<TimeRemaining | null>(null);

  const {
    staking: { getUnstakeTime },
  } = useSpiceBazaar();

  // Fetch unstake time on mount
  useEffect(() => {
    const fetchUnstakeTime = async () => {
      setIsLoading(true);
      try {
        const time = await getUnstakeTime();
        setUnstakeTimeRemaining(time);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUnstakeTime();
  }, [getUnstakeTime]);

  // Update countdown every second, but only if we have a valid unstakeTimeRemaining
  useEffect(() => {
    if (unstakeTimeRemaining === null) return;

    const now = Math.floor(Date.now() / 1000);
    const diff = unstakeTimeRemaining - now;

    // If no time remaining, clear countdown and don't start interval
    if (diff <= 0) {
      setCountdown(null);
      return;
    }

    // Set initial countdown value
    const updateCountdown = () => {
      const now = Math.floor(Date.now() / 1000);
      const diff = unstakeTimeRemaining - now;

      if (diff <= 0) {
        setCountdown(null);
        return false; // Return false to clear interval
      }

      const days = Math.floor(diff / (24 * 60 * 60));
      const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
      const minutes = Math.floor((diff % (60 * 60)) / 60);
      const seconds = diff % 60;

      setCountdown({ days, hours, minutes, seconds });
      return true; // Return true to keep interval
    };

    // Set initial value
    updateCountdown();

    // Start interval
    const timer = setInterval(() => {
      const shouldContinue = updateCountdown();
      if (!shouldContinue) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [unstakeTimeRemaining]);

  const shouldShowCountdown = !isLoading && countdown !== null;

  return {
    isLoading,
    countdown,
    shouldShowCountdown,
  };
};
