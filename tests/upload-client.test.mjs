import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { MAX_UPLOAD_BYTES, UPLOAD_IDLE_TIMEOUT_MS, uploadFile, readPsdDimensions } from '../lib/upload.ts';

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('@/')) return nextResolve(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
        return nextResolve(specifier, context);
    },
});
const { uploadAsset, getMediaDimensions } = await import('../components/editor/utils.ts');

function globalMock(t, name, value) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]);
}
function mockXhr(t) {
    const instances = [];
    globalMock(t, 'XMLHttpRequest', class {
        upload = {};
        headers = {};
        constructor() { instances.push(this); }
        open(method, url) { this.method = method; this.url = url; }
        setRequestHeader(key, value) { this.headers[key] = value; }
        send(body) { this.body = body; }
        abort() { this.aborted = true; this.onabort?.(); }
        respond(status = 200, response = { name: 'saved.psd', url: '/uploads/saved.psd' }) {
            this.status = status; this.response = response; this.onload();
        }
    });
    return instances;
}
function psdHeader(width = 2400, height = 3200) {
    const bytes = new Uint8Array(26);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x38425053);
    view.setUint16(4, 1);
    view.setUint32(14, height);
    view.setUint32(18, width);
    return bytes;
}

test('sends the raw file, reports transfer/save progress and waits for server completion', async t => {
    const instances = mockXhr(t);
    const file = new File(['content'], '立ち絵.psd');
    const progress = [];
    const controller = new AbortController();
    const uploading = uploadFile(file, value => progress.push(value), controller.signal);
    const xhr = instances[0];
    assert.equal(xhr.method, 'POST');
    assert.equal(xhr.url, '/api/upload');
    assert.equal(xhr.body, file);
    assert.equal(xhr.headers['X-File-Name'], encodeURIComponent(file.name));
    assert.equal(xhr.headers['Content-Type'], 'application/octet-stream');
    xhr.upload.onprogress({ loaded: 3, total: file.size, lengthComputable: true });
    xhr.upload.onload();
    assert.deepEqual(progress.map(p => p.phase), ['uploading', 'uploading', 'saving']);
    assert.equal(progress[1].loaded, 3);
    xhr.respond();
    assert.deepEqual(await uploading, { name: 'saved.psd', url: '/uploads/saved.psd' });
    controller.abort();
    assert.equal(xhr.aborted, undefined, 'completed request detaches cancellation listener');
});

test('progress renews the idle timeout; stalled upload aborts and rejects', async t => {
    const instances = mockXhr(t);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const uploading = uploadFile(new File(['abc'], 'a.psd'), () => {}, new AbortController().signal);
    const rejected = assert.rejects(uploading, /no progress for 2 minutes/);
    t.mock.timers.tick(UPLOAD_IDLE_TIMEOUT_MS - 1);
    instances[0].upload.onprogress({ loaded: 1, total: 3, lengthComputable: true });
    t.mock.timers.tick(UPLOAD_IDLE_TIMEOUT_MS - 1);
    assert.equal(instances[0].aborted, undefined);
    t.mock.timers.tick(1);
    await rejected;
    assert.equal(instances[0].aborted, true);
});

test('cancellation and transport/server errors all settle the upload', async t => {
    const instances = mockXhr(t);
    for (const failure of ['cancel', 'network', 'http', 'invalid']) {
        const controller = new AbortController();
        const uploading = uploadFile(new File(['abc'], 'a.psd'), () => {}, controller.signal);
        const rejected = assert.rejects(uploading, failure === 'cancel' ? { name: 'AbortError' } : /connection failed|too big|Invalid upload response/);
        const xhr = instances.at(-1);
        if (failure === 'cancel') controller.abort();
        if (failure === 'network') xhr.onerror();
        if (failure === 'http') xhr.respond(413, { error: 'too big' });
        if (failure === 'invalid') xhr.respond(200, null);
        await rejected;
    }
});

test('empty, oversized and already cancelled files never start a request', async t => {
    const instances = mockXhr(t);
    await assert.rejects(uploadFile(new File([], 'empty.psd'), () => {}, new AbortController().signal), /empty/);
    await assert.rejects(uploadFile({ size: MAX_UPLOAD_BYTES + 1 }, () => {}, new AbortController().signal), /1 GiB/);
    await assert.rejects(uploadFile(new File(['a'], 'a.psd'), () => {}, AbortSignal.abort()), { name: 'AbortError' });
    assert.equal(instances.length, 0);
    const controller = new AbortController();
    await assert.rejects(uploadFile(new File(['a'], 'a.psd'), () => controller.abort(), controller.signal), { name: 'AbortError' });
    assert.equal(instances[0].body, undefined);
});

test('reads only 26 PSD header bytes and validates dimensions and format', async () => {
    assert.deepEqual(await readPsdDimensions({ slice(start, end) {
        assert.equal(start, 0); assert.equal(end, 26);
        return new Blob([psdHeader()]);
    } }), { width: 2400, height: 3200 });
    assert.deepEqual(await readPsdDimensions(new Blob([psdHeader(30_000, 1)])), { width: 30_000, height: 1 });
    for (const dimensions of [[0, 1], [1, 0], [30_001, 1], [1, 30_001]]) {
        await assert.rejects(readPsdDimensions(new Blob([psdHeader(...dimensions)])), /dimensions/);
    }
    await assert.rejects(readPsdDimensions(new Blob([psdHeader().slice(0, 25)])), /header/);
    const badSignature = psdHeader(); badSignature[0] = 0;
    const badVersion = psdHeader(); badVersion[5] = 2;
    for (const header of [badSignature, badVersion]) await assert.rejects(readPsdDimensions(new Blob([header])), /Invalid PSD file/);
});

test('PSD asset gets real dimensions without downloading or using an image decoder', async t => {
    const instances = mockXhr(t);
    globalMock(t, 'window', { location: { origin: 'http://localhost:3000' } });
    globalMock(t, 'Image', class { constructor() { throw new Error('PSD must not use Image'); } });
    t.mock.method(globalThis, 'fetch', () => { throw new Error('PSD must not download again'); });
    const uploading = uploadAsset(new File([psdHeader()], '立ち絵.psd'), () => {}, new AbortController().signal);
    // Blob.arrayBuffer() settles before the network request is constructed.
    await new Promise(resolve => setImmediate(resolve));
    instances[0].respond();
    assert.deepEqual(await uploading, { name: 'saved.psd', url: '/uploads/saved.psd', type: 'tachie', duration: 0, width: 2400, height: 3200 });
});

test('unresponsive media metadata has a deadline and releases its resource', async t => {
    const images = [];
    globalMock(t, 'Image', class extends EventTarget {
        constructor() { super(); images.push(this); }
        removeAttribute(name) { delete this[name]; }
    });
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const dimensions = getMediaDimensions('/slow.png', 'image');
    t.mock.timers.tick(15_000);
    assert.deepEqual(await dimensions, { width: 600, height: 600 });
    assert.equal(images[0].src, undefined);
    const controller = new AbortController();
    const cancelled = getMediaDimensions('/slow.png', 'image', controller.signal);
    controller.abort();
    assert.deepEqual(await cancelled, { width: 600, height: 600 });
    assert.equal(images[1].src, undefined);
});
