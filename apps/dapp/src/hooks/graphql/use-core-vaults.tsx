import axios, { AxiosRequestConfig } from 'axios';
import useRequestState from 'hooks/use-request-state';

import env from 'constants/env';
import { useState } from 'react';

const createGetCoreVaultsRequest = (): AxiosRequestConfig => {
  return {
    method: 'post',
    url: 'http://localhost:8000/subgraphs/name/templedao-core',
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      query: `{
        vaults {
          id
          name
          tvl
          firstPeriodStartTimestamp
          enterExitWindowDuration
        }
      }`,
    },
  };
};

export const useCoreVaults = () => {
  return useRequestState(() => axios(createGetCoreVaultsRequest()));
};