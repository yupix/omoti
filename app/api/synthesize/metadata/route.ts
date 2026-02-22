
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
            const res = await fetch(`${baseUrl}/presets`).catch(() => null);
            if (!res || !res.ok) return NextResponse.json([]);
            const data = await res.json();
            return NextResponse.json(data.presets || []);
        } else {
            const res = await fetch(`${baseUrl}/speakers`).catch(() => null);
            if (!res || !res.ok) return NextResponse.json([]);
            const data = await res.json();
            return NextResponse.json(data);
        }
    } catch (error: any) {
        console.warn('Fetch synth metadata warning (offline?):', error.message);
        return NextResponse.json([]);
    }
}
