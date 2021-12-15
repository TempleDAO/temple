module.exports = {
  async headers() {
    return [
      // This pattern matches localhost and allows connecting from local env
      {
        source: "/api/:path*",
        has: [
          {
            type: "header",
            key: "origin",
            value: "^http://localhost:(?<port>[0-9]+)"
          }
        ],
        headers: [{ key: "Access-Control-Allow-Origin", value: "http://localhost::port" }]
      },
      // this pattern will match anything EXCEPT localhost and will return "templedao.link" as the cors header
      {
        source: "/api/:path*",
        has: [
          {
            type: "host",
            value: "^(?!localhost$).*"
          }
        ],
        headers: [{ key: "Access-Control-Allow-Origin", value: "http://templedao.link" }]
      }
    ];
  }
};
