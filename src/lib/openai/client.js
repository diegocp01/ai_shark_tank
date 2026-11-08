import Ajv from "ajv";
const ajv = new Ajv();

export class AIError extends Error {
  constructor(message, status = 502) { super(message); this.status = status; }
}

export function createOpenAIClient({ apiKey, fetchImpl = fetch, model = "gpt-6.1-sol", effort = "medium", tier = "ultrafast" } = {}) {
  if (!apiKey) throw new AIError("OpenAI is not configured on the server.", 503);
  async function request(path, body, timeout = 120000) {
    let response;
    try {
      response = await fetchImpl(`https://api.openai.com/v1/${path}`, {
        method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: AbortSignal.timeout(timeout),
      });
    } catch { throw new AIError("OpenAI could not be reached. Please try again."); }
    if (!response.ok) {
      const code = response.status;
      // Do not forward provider bodies, headers, or request objects to clients/logs.
      if (code === 401 || code === 403) throw new AIError("OpenAI denied access. Check the server key and model permissions.", 503);
      if (code === 429) throw new AIError("OpenAI quota or rate limit reached. Check project billing or try again shortly.", 429);
      throw new AIError(`OpenAI rejected the request (HTTP ${code}). The requested model and tier were not changed.`);
    }
    return response;
  }
  return {
    settings: { model, reasoning: effort, serviceTier: tier },
    async json({ name, schema, system, input, maxTokens = 12000 }) {
      const response = await request("responses", {
        model, reasoning: { effort }, service_tier: tier, store: false,
        instructions: system, input: JSON.stringify(input), max_output_tokens: maxTokens,
        text: { format: { type: "json_schema", name, strict: true, schema } },
      });
      const result = await response.json();
      if (result.status !== "completed") throw new AIError("OpenAI did not complete the generation. Please try again.");
      const content = (result.output || []).flatMap(item => item.content || []);
      if (content.some(item => item.type === "refusal")) throw new AIError("The model could not generate this pitch. Try a different idea.", 422);
      let data;
      try { data = JSON.parse(content.filter(item => item.type === "output_text").map(item => item.text).join("")); }
      catch { throw new AIError("OpenAI returned an unreadable result. Please try again."); }
      if (!ajv.compile(schema)(data)) throw new AIError("OpenAI returned a result outside the pitch format. Please try again.");
      return { data, metadata: { model: result.model, requestedTier: tier, servedTier: result.service_tier || null, reasoning: effort } };
    },
    async speech({ text, voice, instructions }) {
      const response = await request("audio/speech", { model: "gpt-4o-mini-tts", input: text, voice, instructions, response_format: "mp3" }, 45000);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw new AIError("OpenAI returned an invalid audio clip.");
      return buffer;
    },
  };
}
