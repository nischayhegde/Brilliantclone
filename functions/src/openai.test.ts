import { describe, it, expect, vi } from 'vitest'
import { callModel, MODEL, type OpenAILike } from './openai'

// Prove "no network": even the default-client path uses a fully mocked SDK class.
vi.mock('openai', () => ({
  default: class MockOpenAI {
    responses = { create: vi.fn().mockResolvedValue({ output_text: 'from-default-client' }) }
  },
}))

function mockClient(output_text: string): { client: OpenAILike; create: ReturnType<typeof vi.fn> } {
  const create = vi.fn().mockResolvedValue({ output_text })
  return { client: { responses: { create } }, create }
}

describe('callModel', () => {
  it('builds a GPT-5.5 Responses request with reasoning.effort=medium and returns text', async () => {
    const { client, create } = mockClient('hello world')
    const res = await callModel({ input: 'hi' }, client)

    expect(res).toEqual({ text: 'hello world' })
    const req = create.mock.calls[0][0]
    expect(req.model).toBe(MODEL)
    expect(req.model).toBe('gpt-5.5')
    expect(req.input).toBe('hi')
    expect(req.reasoning).toEqual({ effort: 'medium' })
    // No structured output / temperature requested → those keys are omitted.
    expect(req.text).toBeUndefined()
    expect(req.temperature).toBeUndefined()
    expect(req.instructions).toBeUndefined()
  })

  it('passes instructions, temperature and max_output_tokens through when provided', async () => {
    const { client, create } = mockClient('ok')
    await callModel({ input: 'q', instructions: 'be terse', temperature: 0.3, maxOutputTokens: 256 }, client)

    const req = create.mock.calls[0][0]
    expect(req.instructions).toBe('be terse')
    expect(req.temperature).toBe(0.3)
    expect(req.max_output_tokens).toBe(256)
  })

  it('requests structured output and parses JSON when jsonSchema is given', async () => {
    const { client, create } = mockClient('{"direction":"long","ok":true}')
    const res = await callModel(
      { input: 'compose', jsonSchema: { name: 'Layout', schema: { type: 'object' } } },
      client,
    )

    expect(res.text).toBe('{"direction":"long","ok":true}')
    expect(res.json).toEqual({ direction: 'long', ok: true })
    const req = create.mock.calls[0][0]
    expect(req.text).toEqual({
      format: { type: 'json_schema', name: 'Layout', schema: { type: 'object' }, strict: true },
    })
  })

  it('honours an explicit strict:false on the schema', async () => {
    const { client, create } = mockClient('{}')
    await callModel(
      { input: 'x', jsonSchema: { name: 'S', schema: { type: 'object' }, strict: false } },
      client,
    )
    expect(create.mock.calls[0][0].text.format.strict).toBe(false)
  })

  it('returns text with json undefined when structured output is unparseable', async () => {
    const { client } = mockClient('not json at all')
    const res = await callModel(
      { input: 'x', jsonSchema: { name: 'S', schema: { type: 'object' } } },
      client,
    )
    expect(res.text).toBe('not json at all')
    expect(res.json).toBeUndefined()
  })

  it('falls back to the (mocked) default client when none is injected — no network', async () => {
    const res = await callModel({ input: 'hi' })
    expect(res.text).toBe('from-default-client')
  })
})
