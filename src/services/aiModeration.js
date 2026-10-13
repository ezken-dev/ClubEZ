import { GoogleGenAI, Type } from '@google/genai';
import { CONFIG } from '../config.js';

let aiClient = null;

if (CONFIG.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: CONFIG.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.error('[AI MOD] Failed to initialize GoogleGenAI client:', err.message);
  }
}

/**
 * Evaluates message text for toxic behavior, hate speech, severe harassment, or NSFW
 * @param {string} text The message content to evaluate
 * @returns {Promise<{flagged: boolean, confidence: number, categories: string[], reason: string, suggestedAction: string}>}
 */
export async function evaluateMessageWithAI(text) {
  if (!text || text.trim().length === 0) {
    return { flagged: false, confidence: 0, categories: [], reason: 'Empty text', suggestedAction: 'NONE' };
  }

  // If Gemini API is not configured, fallback to heuristic safety scan
  if (!aiClient) {
    return fallbackHeuristicScan(text);
  }

  try {
    const prompt = `You are a real-time Discord community moderation AI for "Club EZKEN".
Evaluate the following message content strictly for severe violations:
- Toxicity or aggressive profanity targeted at members
- Severe harassment or bullying
- Hate speech or discrimination
- NSFW / sexually explicit text
- Dangerous spam, phishing, scams, or malicious links

Message to analyze:
"${text.replace(/"/g, '\\"')}"

Respond in structured JSON format according to the schema. If it is standard casual chat or friendly banter, mark flagged as false.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flagged: { type: Type.BOOLEAN, description: 'True if message violates community guidelines' },
            confidence: { type: Type.NUMBER, description: 'Confidence between 0.0 and 1.0' },
            categories: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Matched violation categories (e.g. TOXICITY, HARASSMENT, HATE_SPEECH, NSFW, SPAM)'
            },
            reason: { type: Type.STRING, description: 'Concise 1-sentence reason for moderation log' },
            suggestedAction: {
              type: Type.STRING,
              description: 'Recommended action: DELETE, TIMEOUT, BAN, or NONE'
            }
          },
          required: ['flagged', 'confidence', 'categories', 'reason', 'suggestedAction']
        }
      }
    });

    const parsed = JSON.parse(response.text.trim());
    return parsed;
  } catch (error) {
    console.error('[AI MOD] Error during Gemini moderation evaluation:', error.message);
    return fallbackHeuristicScan(text);
  }
}

/**
 * Fallback heuristic detection if external AI network is unavailable
 */
function fallbackHeuristicScan(text) {
  const lower = text.toLowerCase();
  const toxicKeywords = ['kill yourself', 'kys', 'hate speech', 'nigger', 'faggot', 'child porn', 'free nitro click'];
  
  for (const kw of toxicKeywords) {
    if (lower.includes(kw)) {
      return {
        flagged: true,
        confidence: 0.95,
        categories: ['TOXICITY', 'SEVERE_HARASSMENT'],
        reason: `Matched severe prohibited keyword pattern (${kw})`,
        suggestedAction: 'DELETE'
      };
    }
  }

  return {
    flagged: false,
    confidence: 0.1,
    categories: [],
    reason: 'Heuristic clean',
    suggestedAction: 'NONE'
  };
}
