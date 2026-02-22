
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { writeFile } from 'fs/promises';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { provider, baseUrl, text, speakerId, preset } = body;

        if (!baseUrl || !text) {
            return NextResponse.json({ error: 'baseUrl and text are required' }, { status: 400 });
        }

        let audioBuffer: Buffer;
        let duration = 0;

        if (provider === 'aivoice') {
            const res = await fetch(`${baseUrl}/synthesize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, preset }),
            });
            if (!res.ok) throw new Error('AIVOICE Synthesis failed');
            const data = await res.json();

            // AIVOICE scale returns a URL in the local network usually, 
            // but let's assume we want to download it to our server to be safe and persistent.
            const audioRes = await fetch(data.url);
            if (!audioRes.ok) throw new Error('Failed to download audio from AIVOICE');
            audioBuffer = Buffer.from(await audioRes.arrayBuffer());
            duration = data.duration;
        } else {
            // VOICEVOX
            // 1. Audio Query
            const queryRes = await fetch(`${baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {
                method: 'POST'
            });
            if (!queryRes.ok) throw new Error('VOICEVOX Audio Query failed');
            const queryData = await queryRes.json();

            // 2. Synthesis
            const synthRes = await fetch(`${baseUrl}/synthesis?speaker=${speakerId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(queryData)
            });
            if (!synthRes.ok) throw new Error('VOICEVOX Synthesis failed');
            audioBuffer = Buffer.from(await synthRes.arrayBuffer());

            // We'll need to calculate duration if we want it accurately. 
            // For now, let's return a placeholder or estimate if we can't easily get it.
            // But we can return the buffer and let the client handle duration for now, 
            // or use a library to parse wav header.
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filename = `synth-${Date.now()}.wav`;
        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, audioBuffer);

        return NextResponse.json({
            success: true,
            url: `/uploads/${filename}`,
            duration: duration // 0 if VOICEVOX, we'll handle on client
        });

    } catch (error: any) {
        console.error('Synthesis error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
