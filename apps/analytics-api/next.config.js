module.exports = {
  async headers() {
    const corsHost = process.env.CORS_HOST || "https://templedao.link";
    return [
      {
        source: "/api/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: corsHost }]
      }
    ];
  }
};
