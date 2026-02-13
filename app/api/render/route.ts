
import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { clips, assetBaseUrl } = body;

        if (!clips) {
            return NextResponse.json({ error: 'No clips provided' }, { status: 400 });
        }

        // エクスポート時にPSD等のアセットを取得するためのベースURL（Next.jsサーバー）
        const baseUrl = assetBaseUrl || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        console.log('Starting render process...');

        // 1. Bundle the code
        const entryPoint = path.join(process.cwd(), 'remotion', 'index.ts');
        console.log('Bundling from:', entryPoint);

        // Check if entry exists
        if (!fs.existsSync(entryPoint)) {
            console.error('Entry point not found:', entryPoint);
            throw new Error('Entry point not found');
        }

        const bundleLocation = await bundle({
            entryPoint,
            // In production you might want to cache this
        });

        console.log('Bundled to:', bundleLocation);

        // 2. Select Composition
        const compositionId = 'MainVideo';
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: compositionId,
            inputProps: {
                clips,
                primaryColor: '#6d28d9',
                assetBaseUrl: baseUrl,
            },
        });

        // 3. Render
        const outputLocation = path.join(process.cwd(), 'public', 'output.mp4');
        console.log('Rendering to:', outputLocation);

        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation,
            inputProps: {
                clips,
                primaryColor: '#6d28d9',
                assetBaseUrl: baseUrl,
            },
            // You can tweak these for speed vs quality
            crf: 20,
            pixelFormat: 'yuv420p',
        });

        console.log('Render complete!');

        return NextResponse.json({
            success: true,
            url: '/output.mp4?t=' + Date.now() // Add timestamp to bust cache
        });

    } catch (error: any) {
        console.error('Render failed:', error);
        return NextResponse.json({
            error: error.message || 'Render failed',
            details: error.stack
        }, { status: 500 });
    }
}
