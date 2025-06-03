import "dotenv/config";

import http from "node:http";
import { IncomingMessage, ServerResponse } from "node:http";

// Target port to forward traffic to
const TARGET_HOST = process.env.TARGET_HOST || "localhost";
const TARGET_PORT = process.env.TARGET_PORT || 11434;
const PORT = process.env.PORT || 8080;

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY is not set");
}

const server = http.createServer(
  (req: IncomingMessage, res: ServerResponse) => {
    if (req.headers["authorization"] !== `Bearer ${process.env.API_KEY}`) {
      res.writeHead(401);
      res.end("Unauthorized");
      return;
    }

    // Forward the request to the target server
    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      // Copy status code and headers from target response
      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);

      // Pipe the response back to the client
      proxyRes.pipe(res);
    });

    // Handle proxy request errors
    proxyReq.on("error", (err) => {
      console.error("Proxy request error:", err);
      res.writeHead(500);
      res.end("Proxy Error");
    });

    // Pipe the client request to the target server
    req.pipe(proxyReq);
  },
);

server.listen(PORT, () => {
  console.log(
    `Proxy server running on port ${PORT}, forwarding to ${TARGET_HOST}:${TARGET_PORT}`,
  );
});
