import local from './local';
import preview from './preview';
import production from './production';

const ENV_VARS = import.meta.env;
const ENV = ENV_VARS.VITE_ENV;

const getEnvironmentConfig = (env: string) => {
  switch (env) {
    case 'production':
      return production;
    case 'preview':
      return preview;
    case 'local':
      return local;
  }
  throw new Error(`Programming Error: Invalid vite env: ${env}`);
};

const environmentConfig = getEnvironmentConfig(ENV);

export default environmentConfig;
