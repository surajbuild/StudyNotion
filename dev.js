const { concurrently } = require("concurrently");

concurrently(
  [
    {
      command: "node --openssl-legacy-provider node_modules/react-scripts/bin/react-scripts.js start",
      name: "client",
      prefixColor: "blue",
    },
    {
      command: "node --watch server/index.js",
      name: "server",
      prefixColor: "yellow",
    },
  ],
  {
    prefix: "name",
    killOthersOn: ["failure"],
  }
);
