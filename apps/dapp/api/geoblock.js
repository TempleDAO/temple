export default function handler(request, response) {
  console.log(request.headers);
  console.log(request.headers['x-vercel-ip-country']);
  console.log(BLOCKED_ISO_COUNTRIES.includes(request.headers['x-vercel-ip-country']));
  // Send response to the user
  response.status(200).json({
    blocked: BLOCKED_ISO_COUNTRIES.includes(request.headers['x-vercel-ip-country']),
  });
}
