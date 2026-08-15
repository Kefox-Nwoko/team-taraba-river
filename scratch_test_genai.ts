import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
console.log("Using API key:", apiKey ? apiKey.slice(0, 10) + "..." : "NONE");

const ai = new GoogleGenAI({ apiKey });

async function run() {
  const models = [
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash-exp",
    "gemini-1.5-flash-8b",
    "gemini-1.5-pro",
    "gemini-2.0-flash"
  ];
  for (const m of models) {
    try {
      console.log("Testing model:", m);
      const res = await ai.models.generateContent({ model: m, contents: "Say hello!" });
      console.log(">>> SUCCESS WITH MODEL:", m, "==>", res.text?.slice(0, 60));
      break;
    } catch (err: any) {
      console.log("Failed model:", m, "==>", err?.message);
    }
  }
}

run();
