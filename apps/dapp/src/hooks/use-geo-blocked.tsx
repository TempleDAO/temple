import { useEffect, useState } from 'react';

export const useGeoBlocked = () => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkBlocked = async () => {
      const blocked = await fetch(`${window.location.href}api/geoblock`)
        .then((res) => res.json())
        .then((res) => res.blocked)
        .catch(() => false);
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
