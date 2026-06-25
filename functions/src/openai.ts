/**
 * Thin, testable wrapper around the OpenAI Responses API for GPT-5.5.
 *
 * Verified against the installed `openai` SDK (v6) types:
 *   client.responses.create({
 *     model: 'gpt-5.5',
 *     instructions,                 // system/developer message (optional)
 *     input,                        // the user prompt (string)
 *     text: { format: { type: 'json_schema', name, schema, strict } }, // structured output
 *     reasoning: { effort: 'medium' },
 *     max_output_tokens,
 *     temperature,                  // optional; reasoning models may ignore it
 *   })
 *   → response.output_text          // convenience getter aggregating output text
 *
 * The OpenAI key is read from `process.env.OPENAI_API_KEY`, which Cloud Functions
 * populates from the `OPENAI_API_KEY` secret at runtime (see index.ts `defineSecret`).
 * NEVER imported by the client bundle — this module lives only in the functions package.
 */
import OpenAI from 'openai'

/** The model slug for this rebuild (Responses API). */
export const MODEL = 'gpt-5.5'

/** Default reasoning effort for GPT-5.5 (per the rebuild plan). */
export const DEFAULT_REASONING_EFFORT = 'medium' as const

/** A JSON-schema structured-output request (maps to `text.format`). */
export interface JsonSchemaSpec {
  /** a-z/A-Z/0-9/_/- , ≤64 chars (OpenAI constraint). */
  name: string
  /** A JSON Schema object describing the desired output. */
  schema: Record<string, unknown>
  /** Strict schema adherence (default true). */
  strict?: boolean
}

export interface CallModelParams {
  /** System/developer instructions (optional). */
  instructions?: string
  /** The user prompt. */
  input: string
  /** When present, requests structured JSON output and parses it into `json`. */
  jsonSchema?: JsonSchemaSpec
  /** Optional sampling temperature; omitted from the request when undefined. */
  temperature?: number
  /** Hard cap on output tokens (the caller is expected to have clamped this). */
  maxOutputTokens?: number
}

export interface CallModelResult {
  /** The aggregated `output_text` from the response. */
  text: string
  /** Parsed JSON, present only when `jsonSchema` was supplied and parsing succeeded. */
  json?: unknown
}

/** Minimal shape this wrapper needs from the OpenAI client (eases mocking/injection). */
export interface OpenAILike {
  responses: {
    create: (params: OpenAI.Responses.ResponseCreateParamsNonStreaming) => Promise<{ output_text: string }>
  }
}

let cachedClient: OpenAILike | undefined

/** Lazily construct (and cache) a real OpenAI client from the runtime secret. */
function defaultClient(): OpenAILike {
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) as unknown as OpenAILike
  }
  return cachedClient
}

/**
 * Call GPT-5.5 once and return its text (plus parsed JSON when a schema was given).
 * Pure transport: no validation, no clamping, no auth — the callable layer owns those.
 * `client` is injectable so unit tests run fully offline against a mock.
 */
export async function callModel(
  params: CallModelParams,
  client: OpenAILike = defaultClient(),
): Promise<CallModelResult> {
  const { instructions, input, jsonSchema, temperature, maxOutputTokens } = params

  const request: OpenAI.Responses.ResponseCreateParamsNonStreaming = {
    model: MODEL,
    input,
    reasoning: { effort: DEFAULT_REASONING_EFFORT },
  }
  if (instructions != null) request.instructions = instructions
  if (typeof temperature === 'number') request.temperature = temperature
  if (typeof maxOutputTokens === 'number') request.max_output_tokens = maxOutputTokens
  if (jsonSchema) {
    request.text = {
      format: {
        type: 'json_schema',
        name: jsonSchema.name,
        schema: jsonSchema.schema,
        strict: jsonSchema.strict ?? true,
      },
    }
  }

  const response = await client.responses.create(request)
  const text = response.output_text ?? ''

  if (jsonSchema) {
    try {
      return { text, json: JSON.parse(text) }
    } catch {
      // Leave json undefined; the caller decides how to handle unparseable output.
      return { text }
    }
  }
  return { text }
}
