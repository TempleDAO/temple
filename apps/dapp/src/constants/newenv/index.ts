import { AppConfig } from './types';
import { getTestAppConfig } from './test';
import { getProdAppConfig } from './prod';

const ENV = import.meta.env.VITE_ENV;

export function getAppConfig(): AppConfig {
  if (ENV == 'preview') {
    return getTestAppConfig();
  } else if (ENV == 'production') {
    return getProdAppConfig();
  } else {
    throw new Error(`Invalid environment: ${ENV}`);
  }
}

// const IS_DEVELOPMENT = MODE == 'development';
// const IS_PREVIEW = MODE == 'preview';

// export const ENABLE_GEOBLOCK = !IS_DEVELOPMENT && !IS_PREVIEW;
// export const ENABLE_POSTHOG_ANALYTICS = !IS_DEVELOPMENT;
// export const ENABLE_API_LOGS = false;
// export const ENABLE_SUBGRAPH_LOGS = false;
// export const ENABLE_ORIGAMI_DATABASE_LOGS = false;

// export { tokenLabelMap } from './tokenLabelMap';
