import type { IncomingMessage } from "node:http";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

const musebookProxy = {
  "/musebook-api": {
    target: "https://musebook.me",
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/musebook-api/, ""),
  },
};

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(raw);
      }
    });
    request.on("error", () => resolve(undefined));
  });
}

/**
 * Serve the Vercel functions in `api/` from the dev server so `npm run dev`
 * is a complete stack (ledger included, on an embedded Postgres). The same
 * handler modules run in production; only the transport differs.
 */
function apiRoutes(): Plugin {
  return {
    name: "musetools-api-routes",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://localhost");
        if (!url.pathname.startsWith("/api")) return next();
        const segments = url.pathname.split("/").filter(Boolean).slice(1);
        const params = Object.fromEntries(url.searchParams.entries()) as Record<string, string>;
        const isPort = segments[0] === "port" && segments[1] === "v1";
        const isX402Proxy = segments[0] === "x402-proxy";
        const modulePath = isX402Proxy
          ? "/api/x402-proxy.ts"
          : isPort
            ? "/api/port/v1/[...path].ts"
            : "/api/network.ts";
        const query: Record<string, string | string[]> = { ...params, path: isPort ? segments.slice(2) : segments };
        let status = 200;
        const response = {
          status(code: number) {
            status = code;
            return response;
          },
          setHeader(name: string, value: string) {
            res.setHeader(name, value);
          },
          json(payload: unknown) {
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(payload));
          },
          send(payload: Buffer | string) {
            res.statusCode = status;
            res.end(payload);
          },
          end() {
            res.statusCode = status;
            res.end();
          },
        };
        try {
          const mod = (await server.ssrLoadModule(modulePath)) as {
            default: (request: unknown, response: unknown) => Promise<void>;
          };
          const body = await readBody(req);
          await mod.default({ method: req.method, query, body, headers: req.headers }, response);
        } catch (error) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ ok: false, error: { code: "DEV_API_ERROR", message: error instanceof Error ? error.message : String(error) } }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), apiRoutes()],
  server: { proxy: musebookProxy },
  preview: { proxy: musebookProxy },
});
