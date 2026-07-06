export function hasEnvOpenAiApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim())
}
