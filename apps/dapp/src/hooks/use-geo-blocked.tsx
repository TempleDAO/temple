import { useEffect, useState } from 'react';

export const useGeoBlocked = () => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const IS_DEVELOPMENT = import.meta.env.MODE == 'development';

  useEffect(() => {
    const checkBlocked = async () => {
      const blocked = await fetch(
        `https://${window.location.host}/api/geoblock`
      )
        .then((res) => res.json())
        .then((res) => res.blocked)
        .catch((err: unknown) => {
          console.log('geoblock error:', err);
          if (IS_DEVELOPMENT) return false; // don't block users on dev
          return true;
        });
      setIsBlocked(blocked);
      setLoading(false);
    };
    checkBlocked();
  }, []);

  return {
    isBlocked,
    loading,
  };
};
