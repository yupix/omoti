import OpenAI from 'openai';
import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from '@google/generative-ai';

export type AiProvider = 'openai' | 'gemini' | 'commandcode';
export type AiMessage = { role: 'user' | 'assistant'; content: string };

export class AiRequestError extends Error {
    status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
}

export function aiErrorStatus(error: unknown) {
    if (error instanceof AiRequestError) return error.status;
    if (error instanceof OpenAI.APIError) return error.status || 502;
    if (error instanceof GoogleGenerativeAIFetchError) return error.status || 502;
    return 502;
}

// Shared transport for generation and editing; neither path silently falls back
// to sample content when the configured provider fails.
export async function requestAiContent({ provider, apiKey, model, systemInstruction, messages, signal }: {
    provider: AiProvider; apiKey?: string; model?: string;
    systemInstruction: string; messages: AiMessage[]; signal?: AbortSignal;
}): Promise<string> {
    let content: string | null | undefined;
    if (provider === 'gemini') {
        const key = apiKey?.trim() || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (!key) throw new AiRequestError('No Gemini API Key', 400);
        const gemini = new GoogleGenerativeAI(key).getGenerativeModel({
            model: 'gemini-flash-latest', systemInstruction,
            generationConfig: { responseMimeType: 'application/json' },
        });
        const result = await gemini.generateContent({
            contents: messages.map(message => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
        }, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000) });
        content = result.response.text();
    } else {
        const commandCode = provider === 'commandcode';
        const key = apiKey?.trim() || (commandCode ? process.env.CMD_API_KEY?.trim() : process.env.OPENAI_API_KEY);
        if (!key) throw new AiRequestError(commandCode ? 'Enter a Command Code API key or set CMD_API_KEY on the server.' : 'No OpenAI API Key', 400);
        const client = new OpenAI({
            apiKey: key, timeout: 120_000, maxRetries: 0,
            ...(commandCode ? { baseURL: 'https://api.commandcode.ai/provider/v1', organization: null, project: null } : {}),
        });
        const modelId = commandCode ? model?.trim() || 'deepseek/deepseek-v4-flash' : 'gpt-4o';
        if (commandCode && modelId.startsWith('claude-')) {
            const response = await client.post<{ content: { type: string; text?: string }[] }>('/messages', {
                headers: { 'anthropic-version': '2023-06-01' },
                body: { model: modelId, max_tokens: 16_384, system: systemInstruction, messages },
                signal,
            });
            content = response.content?.filter(block => block.type === 'text').map(block => block.text || '').join('');
        } else {
            const response = await client.chat.completions.create({
                model: modelId, messages: [{ role: 'system', content: systemInstruction }, ...messages],
                ...(commandCode ? {} : { response_format: { type: 'json_object' as const } }),
            }, { signal });
            content = response.choices?.[0]?.message?.content;
        }
    }
    if (!content?.trim()) throw new AiRequestError(`No content from ${provider}`, 502);
    return content;
}
