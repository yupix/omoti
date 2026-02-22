
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');
    const baseUrl = searchParams.get('baseUrl');

    if (!baseUrl) {
        return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }

    try {
        if (provider === 'aivoice') {
            const res = await fetch(`${baseUrl}/presets`);
            if (!res.ok) throw new Error('Failed to fetch AIVOICE presets');
            const data = await res.json();
            return NextResponse.json(data.presets || []);
        } else {
            const res = await fetch(`${baseUrl}/speakers`);
            if (!res.ok) throw new Error('Failed to fetch VOICEVOX speakers');
            const data = await res.json();
            return NextResponse.json(data);
        }
    } catch (error: any) {
        console.error('Fetch synth metadata error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
