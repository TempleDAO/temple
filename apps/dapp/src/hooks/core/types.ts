import { Nullable } from 'types/util';

export type Callback = () => Promise<void> | (() => void);

export type MetaMaskError = Error & { data?: { message: string } };

export type HookReturnType = [
  { 
    loading: boolean;
    error: Nullable<MetaMaskError>,
  },
  (amount: number) => Promise<void>,
];