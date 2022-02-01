import React from 'react';
import { useLocation } from 'react-router-dom';

export function useHash() {
  const { hash } = useLocation();

  return React.useMemo(() => new URLSearchParams(hash.slice(1)), [hash]);
}

export default function useQuery() {
  const { search } = useLocation();

  return React.useMemo(() => new URLSearchParams(search), [search]);
}
