import { useState, useCallback, useRef, useEffect } from 'react';
import { Nullable, Maybe } from 'types/util';
import useIsMounted from 'hooks/use-is-mounted';

type Request<T extends any, Args extends any[]> = ((...args: Args) => Promise<T>) | (() => Promise<T>);

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

type UseRequestStateReturnType<T extends any, Args extends any[]> = [
  Request<Maybe<T>, Args>,
  RequestResponseState<T>,
];

const useRequestState = <Resp extends any, Args extends any[]>(request: Request<Resp, Args>): UseRequestStateReturnType<Resp, Args> => {
  const isMounted = useIsMounted();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Nullable<Error>>(null);
  const [response, setResponse] = useState<Nullable<Resp>>(null);
  const requestRef = useRef(request);

  useEffect(() => {
    // Keep ref consistent with latest function passed in.
    requestRef.current = request;
  }, [request, requestRef]);
  
  const wrappedRequest = useCallback(async (...args: Args) => {
    setError(null);
    setIsLoading(true);

    let response: Maybe<Resp>;
    try {
      response = await requestRef.current(...args);
      if (isMounted.current) {
        setResponse(response);
      }
    } catch (error) {
      if (isMounted.current) {
        setResponse(null);
        setError(error as Error);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
    return response;
  }, [requestRef, setIsLoading, setResponse, setError, isMounted]);

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