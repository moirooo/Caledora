import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

export const gemini = apiKey
  ? new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { apiVersion: "", baseUrl } } : {}),
  })
  : null;

export const geminiUsesDirectKey = Boolean(process.env.GEMINI_API_KEY);