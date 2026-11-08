import Ajv from "ajv";
import { AIError } from "../openai/client.js";
const ajv = new Ajv();

// Claude's wire schema omits unsupported bounds; the complete schema is still
// enforced locally. Constraints are also described for the model.
export function toClaudeSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toClaudeSchema);
  if (!schema || typeof schema !== "object") return schema;
  const bounds = ["minimum", "maximum", "minLength", "maxLength", "maxItems", "multipleOf"];
  const result = Object.fromEntries(Object.entries(schema).filter(([key]) => !bounds.includes(key)).map(([key, value]) => [key, toClaudeSchema(value)]));
  const constraints = bounds.filter(key => key in schema).map(key => `${key}: ${schema[key]}`);
  if (constraints.length) result.description = [result.description, ...constraints].filter(Boolean).join(". ");
  return result;
}

export function createAnthropicClient({ apiKey, fetchImpl = fetch, model = "claude-sonnet-5-5", effort = "medium" } = {}) {
  return {
    settings: { model, reasoning: effort },
    assertConfigured() {
      if (!apiKey) throw new AIError("Anthropic is not configured. Add ANTHROPIC_API_KEY to the server environment, or use mock mode.", 503);
    },
    async json({ schema, system, input, maxTokens = 4096 }) {
      this.assertConfigured();
      let response;
      try {
        response = await fetchImpl("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
          body: JSON.stringify({ model, max_tokens: maxTokens, system,
            messages: [{ role: "user", content: JSON.stringify(input) }],
            output_config: { effort, format: { type: "json_schema", schema: toClaudeSchema(schema) } } }),
          signal: AbortSignal.timeout(120000),
        });
      } catch { throw new AIError("Anthropic could not be reached. Please try again."); }
      if (!response.ok) {
        if ([401, 403].includes(response.status)) throw new AIError("Anthropic denied access. Check the server key and model permissions.", 503);
        if (response.status === 429) throw new AIError("Anthropic quota or rate limit reached. Please try again shortly.", 429);
        throw new AIError(`Anthropic rejected the request (HTTP ${response.status}).`);
      }
      let result, data;
      try { result = await response.json(); } catch { throw new AIError("Anthropic returned an unreadable response."); }
      if (result.stop_reason === "refusal") throw new AIError("Claude could not generate this turn. Try a different idea.", 422);
      if (result.stop_reason !== "end_turn") throw new AIError("Anthropic did not complete the turn. Please try again.");
      try { data = JSON.parse((result.content || []).filter(block => block.type === "text").map(block => block.text).join("")); }
      catch { throw new AIError("Anthropic returned an unreadable turn."); }
      if (!ajv.compile(schema)(data)) throw new AIError("Anthropic returned a turn outside the required format.");
      return { data, metadata: { provider: "anthropic", model: result.model, reasoning: effort } };
    },
  };
}
