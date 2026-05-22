# BYOI: Bring Your Own Inference

Pipe Refract's deterministic event stream through any LLM and get structured
semantic interpretations back.

```
Refract events → buildInterpretationPrompt → LLM → parseInterpretationResponse
```

Refract never calls a model. This probe is the reference implementation that shows
how to bridge the deterministic observation layer with bring-your-own-inference.

Uses the same env var conventions as refract core (and all other labs probes).

## Usage

Pipe Refract NDJSON events via stdin:

```bash
# Deterministic summary (no model needed)
refract export "Bitcoin" --format ndjson | bun run probe:byoi

# With local model (Ollama)
REFRACT_INFERENCE_ENDPOINT=http://localhost:11434/v1/chat/completions refract export "Bitcoin" --format ndjson | bun run probe:byoi

# With DeepSeek
REFRACT_INFERENCE_ENDPOINT=https://api.deepseek.com/v1/chat/completions REFRACT_INFERENCE_API_KEY=sk-... refract export "Bitcoin" --format ndjson | bun run probe:byoi

# Set page title for richer output
BYOI_PAGE_TITLE="Bitcoin" refract export "Bitcoin" --format ndjson | bun run probe:byoi
```

## Output

The probe produces a JSON object with every event merged with its model
interpretation:

```json
{
  "pageTitle": "Bitcoin",
  "modelUsed": "gemma4:26b (http://localhost:11434/v1/chat/completions)",
  "totalEvents": 330,
  "interpretedCount": 330,
  "avgConfidence": 0.82,
  "events": [
    {
      "eventType": "sentence_first_seen",
      "fromRevisionId": 275832581,
      "toRevisionId": 275832690,
      "modelInterpretation": {
        "semanticChange": "New claim introduced in lead section defining Bitcoin as a peer-to-peer network",
        "confidence": 0.94,
        "policyDimension": "verifiability",
        "discussionType": "content_addition"
      }
    }
  ]
}
```

## Architecture

This probe shows the BYOI pattern that Refract's architecture is designed for:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│  Refract      │────▶│  You bring the   │────▶│  Interpreted │
│  (events)   │     │  LLM (any kind)  │     │  events      │
└─────────────┘     └──────────────────┘     └─────────────┘
```

Refract provides the **format pipeline** (events → prompt → schema → parser).
You provide the **model**. No API keys in Refract. No SDK dependencies. No
model coupling.

The prompt construction and response parsing in this probe mirror the
exported functions in `@refract-org/evidence-graph`:
- `buildInterpretationPrompt()` — formats events into an LLM prompt
- `parseInterpretationResponse()` — extracts structured interpretations from LLM output
- `ModelInterpretationSchema` — JSON Schema for `response_format: json_schema`
