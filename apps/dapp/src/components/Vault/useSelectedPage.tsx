import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Maybe } from 'types/util';
import { VaultPage } from './types';

const VAULT_PAGES: VaultPage[] = [
  'claim',
  'stake',
  'summary',
  'strategy',
  'timing',
];

export const useSelectedPage = (): Maybe<VaultPage> => {
  const { pathname } = useLocation();
  const pageName = VAULT_PAGES.find((page) => pathname.endsWith(page));

  useEffect(() => {
    if (!pageName) {
      console.error('Programming Error: Invalid page name');
    }
  }, [pageName]);

  return pageName;
};
