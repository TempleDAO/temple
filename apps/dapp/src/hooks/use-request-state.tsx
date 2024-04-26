import { useState, useCallback, useRef, useEffect } from 'react';
import { Nullable, Maybe } from 'types/util';
import useIsMounted from 'hooks/use-is-mounted';

type Request<T, Args extends any[]> =
  | ((...args: Args) => Promise<T>)
  | (() => Promise<T>);

export const createMockRequest = <T,>(
  response: T,
  requestTimeMs = 500,
  canThrowError = false
): ((...args: any[]) => Promise<T>) => {
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

type RequestResponseState<T, Args> = {
  isLoading: boolean;
  error: Nullable<Error>;
  response: Nullable<T>;
  args: Nullable<Args>;
};

type UseRequestStateReturnType<T, Args extends any[]> = [
  Request<Maybe<T>, Args>,
  RequestResponseState<T, Args>
];

interface Options {
  purgeResponseOnRefetch?: boolean;
  shouldReThrow?: boolean;
}

const useRequestState = <Resp, Args extends any[]>(
  request: Request<Resp, Args>,
  options?: Options
): UseRequestStateReturnType<Resp, Args> => {
  const isMounted = useIsMounted();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Nullable<Error>>(null);
  const [response, setResponse] = useState<Nullable<Resp>>(null);
  const [args, setArguments] = useState<Nullable<Args>>(null);
  const requestRef = useRef(request);
  const purgeResponse = options?.purgeResponseOnRefetch || false;

  useEffect(() => {
    // Keep ref consistent with latest function passed in.
    requestRef.current = request;
  }, [request, requestRef]);

  const wrappedRequest = useCallback(
    async (...args: Args) => {
      setError(null);
      setIsLoading(true);
      setArguments(args);

      if (purgeResponse) {
        setResponse(null);
      }

      let response: Maybe<Resp>;
      let throwableError: Maybe<Error>;
      try {
        response = await requestRef.current(...args);
        if (isMounted.current) {
          setResponse(response);
        }
      } catch (error) {
        if (isMounted.current) {
          setResponse(null);
          setError(error as Error);
          throwableError = error as Error;
        }
      } finally {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }

      if (throwableError && options?.shouldReThrow) {
        throw throwableError;
      }

      return response;
    },
    [requestRef, setIsLoading, setResponse, setError, isMounted, purgeResponse]
  );

  return [
    wrappedRequest,
    {
      isLoading,
      error,
      response,
      args,
    },
  ];
};

export default useRequestState;
