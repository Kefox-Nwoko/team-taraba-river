import { onRequest } from "firebase-functions/v2/https";

let app: any = null;
let appLoaded = false;

async function loadApp() {
  if (appLoaded) return app;
  appLoaded = true;
  const serverPath = new URL("../dist/server.cjs", import.meta.url).pathname;
  const module = await import(serverPath);
  app = module.app;
  return app;
}

export const api = onRequest(
  {
    memory: "512MiB",
    timeoutSeconds: 60,
    maxInstances: 10,
    invoker: "public",
  },
  async (req, res) => {
    const expressApp = await loadApp();
    await new Promise<void>((resolve, reject) => {
      expressApp(req as any, res as any, (err?: any) => {
        if (err) {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end("Internal Server Error");
          }
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
);
