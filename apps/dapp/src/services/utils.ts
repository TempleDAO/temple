const ENV_VARS = import.meta.env;
const ENABLE_API_LOGS = ENV_VARS.VITE_ENABLE_API_LOGS === 'true';

if (ENABLE_API_LOGS) {
  console.log('--------------------------------');
  console.log('API LOGS ENABLED');
  console.log('--------------------------------');
}

// log an async request, along with it's response
export async function logged<T>(
  p: Promise<T>,
  params: {
    label: string;
    req?: unknown[];
    resp?(t: T): unknown;
  }
): Promise<T> {
  if (ENABLE_API_LOGS) {
    console.log('--------------------------------');
    console.log('api-request', params.label, ...(params.req || []));
  }
  const t = await p;
  if (ENABLE_API_LOGS) {
    const resp = params.resp && params.resp(t);
    console.log('api-response', params.label, params.req, resp);
    console.log('--------------------------------');
  }
  return t;
}
