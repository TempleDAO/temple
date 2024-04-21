const handler = (request, response) => {
  response.status(200).json({
    country: request.headers['x-vercel-ip-country'],
    blocked: ['US', 'CN', 'RU', 'KP', 'IR'].includes(
      request.headers['x-vercel-ip-country']
    ),
  });
};
export default handler;
