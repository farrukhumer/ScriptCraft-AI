import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY is missing. AI features will not work.");
}

export const ai = new GoogleGenAI({ apiKey: apiKey || "" });

export const STORY_MODEL = "gemini-3-flash-preview";
