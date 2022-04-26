import development from './development';
import staging from './staging';
import production from './production';

const ENV_VARS = import.meta.env;
const ENV = ENV_VARS.VITE_ENV;

const getEnvironmentConfig = (env: string) => {
  switch (env) {
    case 'production': return production;
    case 'staging': return staging;
    case 'development': return development;
  }
  throw new Error(`Programming Error: Invalid vite env: ${env}`);
}

const environemntConfig = getEnvironmentConfig(ENV);

export default environemntConfig;