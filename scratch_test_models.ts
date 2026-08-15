import "dotenv/config";
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
console.log("Using API key:", apiKey ? apiKey.slice(0, 10) + "..." : "NONE");

const ai = new GoogleGenAI({ apiKey });

async function run() {
  try {
    const list = await ai.models.list();
    console.log("Available models:");
    for await (const m of list) {
      console.log("-", m.name);
    }
  } catch (err) {
    console.error("List models error:", err);
  }
}

run();
