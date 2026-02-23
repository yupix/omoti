export interface CevioaiSpeaker {
    name: string;
    speaker_uuid: string; // Cast name acts as UUID
    styles: { id: number; name: string }[];
}

export const getCevioaiSpeakers = async (baseUrl: string): Promise<CevioaiSpeaker[]> => {
    try {
        const res = await fetch(`/api/synthesize/metadata?provider=cevioai&baseUrl=${encodeURIComponent(baseUrl)}`);
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        console.error('Failed to fetch CeVIO AI speakers', e);
        return [];
    }
};

export const synthesizeCevioai = async (
    baseUrl: string,
    text: string,
    cast: string,
    options: { speed?: number; tone?: number; alpha?: number; volume?: number } = {}
) => {
    try {
        const res = await fetch(`${baseUrl}/synthesize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                cast,
                ...options
            })
        });

        if (!res.ok) throw new Error('Cevio AI synthesis failed');
        return await res.json();
    } catch (e) {
        console.error(e);
        return null;
    }
};
