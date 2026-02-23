export interface VoicevoxSpeaker {
    name: string;
    speaker_uuid: string;
    styles: VoicevoxStyle[];
}

export interface VoicevoxStyle {
    name: string;
    id: number;
}

export interface VoicevoxAudioQuery {
    // We only need this as an opaque object to pass to /synthesis
    [key: string]: any;
}

export const getVoicevoxSpeakers = async (baseUrl: string): Promise<VoicevoxSpeaker[]> => {
    try {
        const res = await fetch(`/api/synthesize/metadata?provider=voicevox&baseUrl=${encodeURIComponent(baseUrl)}`);
        if (!res.ok) throw new Error('Failed to fetch VOICEVOX speakers');
        return await res.json();
    } catch (err) {
        console.error('VOICEVOX Speakers error:', err);
        return [];
    }
};

export const synthesizeVoicevox = async (baseUrl: string, text: string, speakerId: number): Promise<{ url: string; duration: number } | null> => {
    try {
        const res = await fetch('/api/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: 'voicevox',
                baseUrl,
                text,
                speakerId
            })
        });
        if (!res.ok) throw new Error('VOICEVOX Synthesis failed');
        const data = await res.json();
        return { url: data.url, duration: data.duration };
    } catch (err) {
        console.error('VOICEVOX Synthesis error:', err);
        return null;
    }
};
