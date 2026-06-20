import { db } from '@/lib/db';
import { getProfileStats, type ProfileStats } from '@/lib/dsa/profile';

export type AiAnalysis = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  generatedAt: string;
};

const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function statsDigest(stats: ProfileStats): string {
  const diff = (['easy', 'medium', 'hard'] as const)
    .map((d) => `${d}: ${stats.byDifficulty[d].solved}/${stats.byDifficulty[d].total}`)
    .join(', ');
  const strengths = stats.strengths.map((t) => `${t.title} (${t.solved}/${t.total})`).join(', ') || 'none yet';
  const focus = stats.focusAreas.map((t) => `${t.title} (${t.solved}/${t.total})`).join(', ') || 'none';
  const langs = stats.languages.map((l) => `${l.language} x${l.count}`).join(', ') || 'none';
  return [
    `Solved ${stats.solved}/${stats.totalPublished}; tried-but-unsolved ${stats.tried}.`,
    `By difficulty — ${diff}.`,
    `Acceptance rate ${(stats.acceptanceRate * 100).toFixed(0)}% over ${stats.totalSubmissions} submissions.`,
    `Current streak ${stats.streakDays} day(s). Languages: ${langs}.`,
    `Strong topics: ${strengths}. Weak/low-coverage topics: ${focus}.`,
  ].join('\n');
}

function buildPrompt(stats: ProfileStats): string {
  return `You are a coding-interview coach. Based ONLY on this student's practice data, give a short, honest, encouraging analysis.

DATA:
${statsDigest(stats)}

Reply with ONLY a JSON object, no markdown:
{"summary": "2-3 sentence overview of where they stand", "strengths": ["..."], "weaknesses": ["..."], "recommendations": ["concrete next steps, reference topics/difficulties from the data"]}
Keep each array to 2-4 short, specific items grounded in the data above.`;
}

function extractJson(text: string): Omit<AiAnalysis, 'generatedAt'> | null {
  const cleaned = text.replace(/```json|```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const o = JSON.parse(match[0]);
    const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
    if (typeof o.summary !== 'string') return null;
    return { summary: o.summary, strengths: arr(o.strengths), weaknesses: arr(o.weaknesses), recommendations: arr(o.recommendations) };
  } catch {
    return null;
  }
}

async function callLLM(prompt: string): Promise<string> {
  const provider = (process.env.AI_PROVIDER || 'openai-compatible').toLowerCase();
  const attempt = async (): Promise<Response> => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      if (provider === 'ollama') {
        const baseUrl = (process.env.OLLAMA_BASE_URL || '').replace(/\/+$/, '');
        return await fetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: process.env.OLLAMA_MODEL, stream: false, messages: [{ role: 'user', content: prompt }], options: { temperature: 0.3 } }),
          signal: ctrl.signal,
        });
      }
      const baseUrl = (process.env.AI_BASE_URL || process.env.OPENAI_BASE_URL || '').replace(/\/+$/, '');
      const apiKey = process.env.AI_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY || '';
      return await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: process.env.AI_MODEL || 'meta/llama-3.1-8b-instruct', messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 600 }),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  };

  let lastErr = '';
  for (let i = 0; i < 3; i += 1) {
    if (i > 0) await sleep(600 * 2 ** (i - 1));
    try {
      const res = await attempt();
      if (res.status === 429 || res.status >= 500) { lastErr = `LLM ${res.status}`; continue; }
      if (!res.ok) throw new Error(`LLM ${res.status}`);
      const data = await res.json();
      return provider === 'ollama' ? data?.message?.content ?? '' : data?.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  throw new Error(lastErr || 'LLM request failed');
}

export function parseCachedAnalysis(json: string | null | undefined): AiAnalysis | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AiAnalysis;
  } catch {
    return null;
  }
}

// Generates a fresh analysis from real stats and caches it on the StudentProfile.
export async function generateAiAnalysis(userId: string): Promise<AiAnalysis> {
  const stats = await getProfileStats(userId);
  if (stats.totalSubmissions === 0) {
    const empty: AiAnalysis = {
      summary: 'No submissions yet — solve a few problems and come back for a personalized analysis.',
      strengths: [],
      weaknesses: [],
      recommendations: ['Start with an Easy problem in Arrays & Hashing.', 'Aim for a 3-day solving streak to build momentum.'],
      generatedAt: new Date().toISOString(),
    };
    return empty;
  }

  const raw = await callLLM(buildPrompt(stats));
  const parsed = extractJson(raw);
  if (!parsed) throw new Error('Could not parse AI analysis');
  const analysis: AiAnalysis = { ...parsed, generatedAt: new Date().toISOString() };

  await db.studentProfile.upsert({
    where: { userId },
    create: { userId, aiAnalysisJson: JSON.stringify(analysis), aiAnalysisAt: new Date() },
    update: { aiAnalysisJson: JSON.stringify(analysis), aiAnalysisAt: new Date() },
  });
  return analysis;
}
