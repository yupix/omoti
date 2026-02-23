
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
        } else if (provider === 'cevioai') {
            const res = await fetch(`${baseUrl}/synthesize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, cast: body.cast }),
            });
            if (!res.ok) throw new Error('CeVIO AI Synthesis failed');
            const data = await res.json();

            // CeVIO server returns a URL like /uploads/filename
            // Since it's on the same machine/shared public folder in some setups, 
            // but let's be robust and fetch it if it's a full URL or relative to its host
            const audioUrl = data.url.startsWith('http') ? data.url : `${baseUrl}${data.url}`;
            const audioRes = await fetch(audioUrl);
            if (!audioRes.ok) throw new Error('Failed to download audio from CeVIO AI');
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

            // Simple WAV duration calculator
            try {
                const byteRate = audioBuffer.readUInt32LE(28);
                const dataSize = audioBuffer.readUInt32LE(40);
                duration = dataSize / byteRate;
            } catch (e) {
                duration = 0;
            }
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
