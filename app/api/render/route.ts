import { NextRequest, NextResponse } from 'next/server';
import { bundle } from '@remotion/bundler';
import { openBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import path from 'path';
import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';

export async function POST(req: NextRequest) {
    let workDir: string | undefined;
    let browser: Awaited<ReturnType<typeof openBrowser>> | undefined;
    try {
        const body = await req.json();
        const { clips, assetBaseUrl } = body;

        if (!Array.isArray(clips)) {
            return NextResponse.json({ error: 'No clips provided' }, { status: 400 });
        }

        // エクスポート時にPSD等のアセットを取得するためのベースURL（Next.jsサーバー）
        const baseUrl = assetBaseUrl || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

        console.log('Starting render process...');

        // 1. Bundle the code
        const entryPoint = path.join(process.cwd(), 'remotion', 'index.ts');
        console.log('Bundling from:', entryPoint);

        workDir = await fs.mkdtemp(path.join(tmpdir(), 'omoti-render-'));
        const publicDir = path.join(workDir, 'public');
        await fs.mkdir(publicDir);
        const bundleLocation = await bundle({
            entryPoint,
            outDir: path.join(workDir, 'bundle'),
            // Uploaded media already resolve against assetBaseUrl. Copying all
            // PSDs (and previous exports) into every bundle only duplicates I/O.
            publicDir,
        });

        console.log('Bundled to:', bundleLocation);

        // 2. Select Composition
        browser = await openBrowser('chrome');
        const inputProps = { clips, primaryColor: '#6d28d9', assetBaseUrl: baseUrl };
        const compositionId = 'MainVideo';
        const composition = await selectComposition({
            serveUrl: bundleLocation,
            id: compositionId,
            inputProps,
            puppeteerInstance: browser,
        });

        // 3. Render
        const outputLocation = path.join(process.cwd(), 'public', 'output.mp4');
        console.log('Rendering to:', outputLocation);

        await renderMedia({
            composition,
            serveUrl: bundleLocation,
            codec: 'h264',
            outputLocation,
            inputProps,
            puppeteerInstance: browser,
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
    } finally {
        if (browser) await browser.close({ silent: true }).catch(error => console.error('Browser cleanup failed:', error));
        if (workDir) await fs.rm(workDir, { recursive: true, force: true }).catch(error => console.error('Bundle cleanup failed:', error));
    }
}
