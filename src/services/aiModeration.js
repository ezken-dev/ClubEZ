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
 * and generates personalized smart AI warnings with DO and DON'T advice.
 * @param {string} text The message content to evaluate
 * @returns {Promise<{flagged: boolean, confidence: number, categories: string[], reason: string, suggestedAction: string, smartWarning: string, adviceDo: string, adviceDont: string}>}
 */
export async function evaluateMessageWithAI(text) {
  if (!text || text.trim().length === 0) {
    return {
      flagged: false,
      confidence: 0,
      categories: [],
      reason: 'Empty text',
      suggestedAction: 'NONE',
      smartWarning: '',
      adviceDo: '',
      adviceDont: ''
    };
  }

  // If Gemini API is not configured, fallback to heuristic safety scan
  if (!aiClient) {
    return fallbackHeuristicScan(text);
  }

  try {
    const prompt = `You are a real-time smart Discord community moderation AI for "Club EZKEN" (Ken's community).
Evaluate the following message content strictly for violations:
- Toxicity, insulting members, aggressive profanity targeted at people
- Severe harassment, bullying, or intimidation
- Hate speech or discrimination
- NSFW / sexually explicit content
- Dangerous spam, phishing, scam links, unauthorized discord invites

Message to analyze:
"${text.replace(/"/g, '\\"')}"

If the message is acceptable, friendly banter, or normal gaming chat, return flagged: false.
If flagged: true, you MUST write:
1. "smartWarning": A direct, personalized message explaining to the user what they did wrong.
2. "adviceDo": Practical, positive advice on what they SHOULD do instead in Club EZKEN.
3. "adviceDont": Clear, firm advice on what they must NOT do going forward.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
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
            },
            smartWarning: {
              type: Type.STRING,
              description: 'Direct personalized warning to send to the offending user'
            },
            adviceDo: {
              type: Type.STRING,
              description: 'What the user should do instead'
            },
            adviceDont: {
              type: Type.STRING,
              description: 'What the user must avoid doing'
            }
          },
          required: ['flagged', 'confidence', 'categories', 'reason', 'suggestedAction', 'smartWarning', 'adviceDo', 'adviceDont']
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
        suggestedAction: 'DELETE',
        smartWarning: `Your message violated Club EZKEN community guidelines due to prohibited language (${kw}). Respectful communication is strictly enforced.`,
        adviceDo: 'Engage respectfully with community members, keep banter friendly, and take a breather if heated.',
        adviceDont: 'Do not use slurs, toxic phrases, or targeted harassment in text or voice channels.'
      };
    }
  }

  return {
    flagged: false,
    confidence: 0,
    categories: [],
    reason: 'Clean',
    suggestedAction: 'NONE',
    smartWarning: '',
    adviceDo: '',
    adviceDont: ''
  };
}
