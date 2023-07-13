import type { VercelRequest, VercelResponse } from '@vercel/node';

// const BLOCKED_ISO_COUNTRIES = ['USA', 'PRK', 'IRN'];

// export default function handler(request: VercelRequest, response: VercelResponse) {
//   console.log(request.headers);
//   console.log(request.headers['x-vercel-ip-country']);
//   console.log(BLOCKED_ISO_COUNTRIES.includes(request.headers['x-vercel-ip-country'] as string));
//   // Send response to the user
//   response.status(200).json({
//     blocked: BLOCKED_ISO_COUNTRIES.includes(request.headers['x-vercel-ip-country'] as string),
//   });
// }
export default function handler(request: VercelRequest, response: VercelResponse) {
  response.status(200).json({
    body: request.body,
    query: request.query,
    cookies: request.cookies,
  });
}
