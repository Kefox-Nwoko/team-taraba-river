import { onRequest } from "firebase-functions/v2/https";
import { app } from "../server";
export const api = onRequest({
    memory: "512MiB",
    timeoutSeconds: 60,
    maxInstances: 10,
    invoker: "public",
}, async (req, res) => {
    await new Promise((resolve, reject) => {
        app(req, res, (err) => {
            if (err) {
                if (!res.headersSent) {
                    res.statusCode = 500;
                    res.end("Internal Server Error");
                }
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
});
