import { useState, useCallback, useRef } from 'react';
import { Nullable, Maybe } from 'types/util';

type Request<T extends any> = ((...args: any[]) => Promise<T>) | (() => Promise<T>);

export const createMockRequest = <T extends any>(
  response: T,
  requestTimeMs = 500,
  canThrowError = false,
): (...args: any[]) => Promise<T> => {
  return () => {
    // If chance of error is enabled, throw 25% of the time.
    const shouldThrow = canThrowError ? Math.random() >= 0.75 : false;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (shouldThrow) {
          reject(new Error('Mock Request Failed'));
          return;
        }
        resolve(response);
      }, requestTimeMs);
    });
  };
};

type RequestResponseState<T> = {
  isLoading: boolean,
  error: Nullable<Error>,
  response: Nullable<T>,
};

type UseRequestStateReturnType<T extends any> = [
  Request<Maybe<T>>,
  RequestResponseState<T>,
];

const useRequestState = <T extends any>(request: Request<T>): UseRequestStateReturnType<T> => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Nullable<Error>>(null);
  const [response, setResponse] = useState<Nullable<T>>(null);
  const requestRef = useRef(request);
  
  const wrappedRequest = useCallback(async (...args) => {
    if (!requestRef.current) {
      return;
    }

    setError(null);
    setIsLoading(true);

    let response: Maybe<T>;
    try {
      response = await requestRef.current(...args);
      setResponse(response);
    } catch (error) {
      setResponse(null);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
    return response;
  }, [requestRef, setIsLoading, setResponse, setError]);

  return [
    wrappedRequest,
    {
      isLoading,
      error,
      response,
    },
  ];
};

export default useRequestState;