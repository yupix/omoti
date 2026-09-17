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
    t.after(() => rm(cwd, { recursive: true, force: true }));
    return path.join(cwd, 'public', 'uploads');
}
function request(body, options = {}) {
    return new Request('http://localhost/api/upload', {
        method: 'POST', body, duplex: 'half', ...options,
        headers: { 'x-file-name': encodeURIComponent('立ち絵.psd'), ...options.headers },
    });
}

test('streams multiple chunks intact and lists only the completed file', async t => {
    const dir = await storage(t);
    let controller;
    const first = Buffer.alloc(64 * 1024, 42);
    const second = Buffer.alloc(1024, 7);
    const body = new ReadableStream({ start(c) { controller = c; c.enqueue(first); } });
    const uploading = POST(request(body, { headers: { 'content-length': String(first.length + second.length) } }));
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
