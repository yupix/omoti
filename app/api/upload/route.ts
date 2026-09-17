import { NextRequest, NextResponse } from 'next/server';
import fs, { createWriteStream } from 'node:fs';
import path from 'node:path';
import { mkdir, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';
import { fileTypeFromFile } from 'file-type';
import { MAX_UPLOAD_BYTES } from '@/lib/upload';

const mediaExtensions = new Set(['jpg', 'png', 'gif', 'mp4', 'webm', 'mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'mkv', 'mov', 'webp', 'bmp', 'avif', 'psd']);

export async function POST(req: NextRequest) {
    const encodedName = req.headers.get('x-file-name');
    if (!encodedName || !req.body) {
        return NextResponse.json({ error: 'A file body and X-File-Name header are required.' }, { status: 400 });
    }
    let filename;
    try {
        filename = decodeURIComponent(encodedName).replace(/[^a-zA-Z0-9.-]/g, '_');
    } catch {
        return NextResponse.json({ error: 'Invalid filename.' }, { status: 400 });
    }
    if (!filename || filename.length > 200) return NextResponse.json({ error: 'Invalid filename.' }, { status: 400 });
    const expectedSize = req.headers.get('content-length');
    if (expectedSize && (!/^\d+$/.test(expectedSize) || Number(expectedSize) > MAX_UPLOAD_BYTES)) {
        return NextResponse.json({ error: 'Files must be 1 GiB or smaller.' }, { status: 413 });
    }
    const id = randomUUID();
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const stagingDir = path.join(process.cwd(), '.uploads-staging');
    const temporaryPath = path.join(stagingDir, `${id}.part`);
    let bytes = 0;
    try {
        await mkdir(uploadDir, { recursive: true });
        await mkdir(stagingDir, { recursive: true, mode: 0o700 });
        const limit = new Transform({
            transform(chunk: Buffer, _encoding, callback) {
                bytes += chunk.length;
                if (bytes > MAX_UPLOAD_BYTES) callback(new Error('Files must be 1 GiB or smaller.'));
                else callback(null, chunk);
            },
        });
        await pipeline(
            Readable.fromWeb(req.body as ReadableStream<Uint8Array>),
            limit,
            createWriteStream(temporaryPath, { flags: 'wx', mode: 0o600 }),
            { signal: req.signal },
        );
        if (bytes === 0 || (expectedSize && bytes !== Number(expectedSize))) {
            return NextResponse.json({ error: 'The upload was empty or incomplete.' }, { status: 400 });
        }
        // Only publish detected, passive media formats; the supplied suffix is untrusted.
        const detected = await fileTypeFromFile(temporaryPath, { signal: req.signal }).catch(error => {
            // Malformed/truncated content is unsupported; filesystem or module
            // errors must reach the server-error handler instead of masquerading as 415.
            if (error instanceof Error && 'code' in error) throw error;
            return undefined;
        });
        const extension = detected?.ext === 'oga' || detected?.ext === 'opus' ? 'ogg' : detected?.ext;
        if (!extension || !mediaExtensions.has(extension)) {
            return NextResponse.json({ error: 'Unsupported file content. Upload a PSD, raster image, video, or audio file. HTML and SVG are not supported.' }, { status: 415 });
        }
        req.signal.throwIfAborted();
        const uniqueFilename = `${id}-${path.parse(filename).name}.${extension}`;
        await rename(temporaryPath, path.join(uploadDir, uniqueFilename));
        return NextResponse.json({ success: true, url: `/uploads/${uniqueFilename}`, name: uniqueFilename });
    } catch (error) {
        const status = bytes > MAX_UPLOAD_BYTES ? 413 : req.signal.aborted ? 408 : 500;
        if (status === 500) console.error('Upload error:', error);
        return NextResponse.json({ error: status === 413 ? 'Files must be 1 GiB or smaller.' : status === 408 ? 'Upload cancelled.' : 'Unable to save the upload.' }, { status });
    } finally {
        await rm(temporaryPath, { force: true });
    }
}

export async function GET() {
    try {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads');

        if (!fs.existsSync(uploadDir)) {
            return NextResponse.json({ files: [] });
        }

        const files = fs.readdirSync(uploadDir);
        // Filter likely media files
        const mediaFiles = files.filter(f => /\.(jpg|jpeg|png|gif|mp4|webm|mp3|wav|ogg|m4a|aac|flac|mkv|mov|webp|bmp|avif|psd)$/i.test(f));

        const fileData = mediaFiles.map(f => ({
            name: f,
            url: `/uploads/${f}`
        }));

        return NextResponse.json({ files: fileData });

    } catch (error) {
        console.error('List files error:', error);
        return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
    }
}
