import { useState, useCallback } from 'react';
import { Nullable } from 'types/util';

type Request<T> = () => Promise<T>;

export const createMockRequest = <T extends object>(
  response: T,
  requestTimeMs = 500,
  canThrowError = false,
): (...args: any[]) => Promise<T> => {
  return () => {
    const shouldThrow = canThrowError ? Math.random() >= 0.5 : false;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (shouldThrow) {
          reject(new Error('Mock Request Failed'));
        }
        resolve(response);
      }, requestTimeMs);
    });
  };
};

type UseRequestStateReturnType<T extends object> = [
  () => Promise<void>,
  {
    isLoading: boolean,
    error: Nullable<Error>,
    response: Nullable<T>,
  }
]

const useRequestState = <T extends object>(request: Request<T>): UseRequestStateReturnType<T> => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Nullable<Error>>(null);
  const [response, setResponse] = useState<Nullable<T>>(null);
  
  const wrappedRequest = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await request();
      setResponse(response);
    } catch (error) {
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [request, setIsLoading, setResponse, setError]);

  return [
    wrappedRequest,
    {
      isLoading,
      error,
      response,
    }
  ];
};

export default useRequestState;