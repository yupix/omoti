import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { MAX_UPLOAD_BYTES } from '../lib/upload.ts';

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('@/')) return nextResolve(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
        return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
    },
});
const { POST, GET } = await import('../app/api/upload/route.ts');

async function storage(t) {
    const cwd = await mkdtemp(path.join(tmpdir(), 'omoti-upload-test-'));
    t.mock.method(process, 'cwd', () => cwd);
    t.after(async () => {
        try {
            const partials = await readdir(path.join(cwd, '.uploads-staging')).catch(() => []);
            assert.deepEqual(partials, [], 'completed, failed and cancelled uploads leave no staging files');
        } finally { await rm(cwd, { recursive: true, force: true }); }
    });
    return path.join(cwd, 'public', 'uploads');
}
function request(body, options = {}) {
    return new Request('http://localhost/api/upload', {
        method: 'POST', body, duplex: 'half', ...options,
        headers: { 'x-file-name': encodeURIComponent('立ち絵.psd'), ...options.headers },
    });
}

function psdBytes() {
    // A complete 256x128 RGB PSD: header, three empty sections, raw composite pixels.
    const bytes = Buffer.alloc(40 + 256 * 128 * 3);
    bytes.write('8BPS');
    bytes.writeUInt16BE(1, 4);
    bytes.writeUInt16BE(3, 12);
    bytes.writeUInt32BE(128, 14);
    bytes.writeUInt32BE(256, 18);
    bytes.writeUInt16BE(8, 22);
    bytes.writeUInt16BE(3, 24);
    bytes.fill(127, 40);
    return bytes;
}

test('streams multiple chunks intact and lists only the completed file', async t => {
    const dir = await storage(t);
    let controller;
    const psd = psdBytes();
    const first = psd.subarray(0, 64 * 1024);
    const second = psd.subarray(first.length);
    const body = new ReadableStream({ start(c) { controller = c; c.enqueue(first); } });
    const uploading = POST(request(body, { headers: { 'content-length': String(first.length + second.length) } }));
    const staging = path.join(path.dirname(path.dirname(dir)), '.uploads-staging');
    // Wait until the stream is actually written, not merely queued.
    for (let i = 0; i < 100 && !(await readdir(staging).catch(() => [])).length; i++) {
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal((await readdir(staging)).length, 1);
    assert.deepEqual(await readdir(dir), [], 'partial bytes must never be public');
    assert.deepEqual((await (await GET()).json()).files, []);
    controller.enqueue(second);
    controller.close();
    const response = await uploading;
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.match(data.name, /^[a-f0-9-]+-___.psd$/);
    assert.equal(data.url, `/uploads/${data.name}`);
    assert.deepEqual(await readFile(path.join(dir, data.name)), Buffer.concat([first, second]));
    assert.deepEqual(await readdir(dir), [data.name]);
    assert.deepEqual((await (await GET()).json()).files, [{ name: data.name, url: data.url }]);
});

test('rejects an empty body and incomplete declared length without leaving files', async t => {
    const dir = await storage(t);
    assert.equal((await POST(request(new Uint8Array()))).status, 400);
    assert.equal((await POST(request('abc', { headers: { 'content-length': '4' } }))).status, 400);
    assert.deepEqual(await readdir(dir), []);
});

test('checks size boundaries and invalid names before saving', async t => {
    const dir = await storage(t);
    assert.equal((await POST(request('a', { headers: { 'content-length': String(MAX_UPLOAD_BYTES + 1) } }))).status, 413);
    // The exact limit is allowed; this body then fails the completeness check.
    assert.equal((await POST(request('a', { headers: { 'content-length': String(MAX_UPLOAD_BYTES) } }))).status, 400);
    for (const name of ['', '%invalid', 'a'.repeat(201)]) {
        assert.equal((await POST(request('a', { headers: { 'x-file-name': name } }))).status, 400);
    }
    assert.deepEqual(await readdir(dir), []);
});

test('cancelled upload closes the stream and removes partial files', async t => {
    const dir = await storage(t);
    const abort = new AbortController();
    let cancelCalled = false;
    const body = new ReadableStream({
        start(controller) { controller.enqueue(new Uint8Array(1024)); },
        cancel() { cancelCalled = true; },
    });
    const uploading = POST(request(body, { signal: abort.signal }));
    // Allow the stream to open and consume the first chunk before aborting.
    await new Promise(resolve => setTimeout(resolve, 20));
    abort.abort();
    assert.equal((await uploading).status, 408);
    assert.equal(cancelCalled, true);
    assert.deepEqual(await readdir(dir), []);
});

test('a broken input stream returns an error and removes partial files', async t => {
    const dir = await storage(t);
    t.mock.method(console, 'error', () => {});
    const body = new ReadableStream({ start(controller) { controller.error(new Error('connection lost')); } });
    assert.equal((await POST(request(body))).status, 500);
    assert.deepEqual(await readdir(dir), []);
});

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5AAAAABJRU5ErkJggg==', 'base64');

test('detects bytes and replaces a misleading active filename extension', async t => {
    const dir = await storage(t);
    for (const [bytes, name, extension] of [[png, 'picture.html', 'png'], [psdBytes(), 'avatar.svg', 'psd']]) {
        const response = await POST(request(bytes, { headers: { 'x-file-name': name, 'content-type': 'text/html' } }));
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(path.extname(data.name), '.' + extension);
        assert.deepEqual(await readFile(path.join(dir, data.name)), bytes);
    }
});

test('rejects active, disguised, unknown and truncated contents without publishing', async t => {
    const dir = await storage(t);
    for (const [bytes, name] of [
        ['<html><script>alert(document.domain)</script></html>', 'page.html'],
        ['<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', 'drawing.svg'],
        ['<script>alert(1)</script>', 'picture.png'],
        ['not a PSD', 'avatar.psd'],
        [Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'broken.png'],
    ]) {
        assert.equal((await POST(request(bytes, { headers: { 'x-file-name': name } }))).status, 415, name);
        assert.deepEqual(await readdir(dir), []);
    }
});

test('upload URLs use sandbox and nosniff headers including previously saved active content', async () => {
    const { default: config } = await import('../next.config.ts');
    const rule = (await config.headers()).find(rule => rule.source === '/uploads/:path*');
    const headers = Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
    assert.equal(headers['X-Content-Type-Options'], 'nosniff');
    assert.match(headers['Content-Security-Policy'], /(?:^|;)\s*sandbox(?:;|$)/);
});
