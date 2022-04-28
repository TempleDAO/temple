export type Callback = () => Promise<void> | (() => void);

export type MetaMaskError = Error & { data?: { message: string } };
