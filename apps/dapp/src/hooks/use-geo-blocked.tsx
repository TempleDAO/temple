import { useEffect, useState } from 'react';

export const useGeoBlocked = () => {
  const [isBlocked, setIsBlocked] = useState(false);
  
  useEffect(() => {
    const checkBlocked = async () => {
      const blocked = await fetch(`${window.location.href}api/geoblock`)
        .then((res) => res.json())
        .then((res) => res.blocked)
        .catch(() => false);
      setIsBlocked(blocked);
    };
    checkBlocked();
  }, []);

  return {
    isBlocked,
  };
};
