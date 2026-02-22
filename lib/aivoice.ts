export interface AIVoicePreset {
    presets: string[];
}

export interface SynthesizeResponse {
    url: string;
    filename: string;
    duration: number;
}

export const getAIVoicePresets = async (baseUrl: string): Promise<string[]> => {
    try {
        const res = await fetch(`/api/synthesize/metadata?provider=aivoice&baseUrl=${encodeURIComponent(baseUrl)}`);
        if (!res.ok) throw new Error('Failed to fetch presets');
        return await res.json();
    } catch (err) {
        console.error('AIVOICE Server error:', err);
        return [];
    }
};

export const synthesizeVoice = async (baseUrl: string, text: string, preset?: string): Promise<SynthesizeResponse | null> => {
    try {
        const res = await fetch('/api/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'aivoice',
                baseUrl,
                text,
                preset
            }),
        });
        if (!res.ok) throw new Error('Synthesis failed');
        return await res.json();
    } catch (err) {
        console.error('AIVOICE Synthesis error:', err);
        return null;
    }
};
