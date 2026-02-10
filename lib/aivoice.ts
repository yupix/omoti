export interface AIVoicePreset {
    presets: string[];
}

export interface SynthesizeResponse {
    url: string;
    filename: string;
    duration: number;
}

const API_BASE = 'http://localhost:8000';

export const getAIVoicePresets = async (): Promise<string[]> => {
    try {
        const res = await fetch(`${API_BASE}/presets`);
        if (!res.ok) throw new Error('Failed to fetch presets');
        const data: AIVoicePreset = await res.json();
        return data.presets;
    } catch (err) {
        console.error('AIVOICE Server error:', err);
        return [];
    }
};

export const synthesizeVoice = async (text: string, preset?: string): Promise<SynthesizeResponse | null> => {
    try {
        const res = await fetch(`${API_BASE}/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, preset }),
        });
        if (!res.ok) throw new Error('Synthesis failed');
        return await res.json();
    } catch (err) {
        console.error('AIVOICE Synthesis error:', err);
        return null;
    }
};
