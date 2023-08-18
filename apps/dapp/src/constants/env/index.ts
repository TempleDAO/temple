import local from './local';
import preview from './preview';
import production from './production';
import previewNexus from './preview-nexus';
import productionNexus from './production-nexus';

const ENV_VARS = import.meta.env;
const ENV = ENV_VARS.VITE_ENV;

const getEnvironmentConfig = (env: string) => {
  switch (env) {
    case 'production': return production;
    case 'production-nexus': return productionNexus;
    case 'preview': return preview;
    case 'preview-nexus': return previewNexus;
    case 'local': return local;
  }
  throw new Error(`Programming Error: Invalid vite env: ${env}`);
}

const environmentConfig = getEnvironmentConfig(ENV);

export default environmentConfig;