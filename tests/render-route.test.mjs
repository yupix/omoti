import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
import { mkdtemp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const mockModule = `export const bundle = (...args) => globalThis.renderMocks.bundle(...args);
export const openBrowser = (...args) => globalThis.renderMocks.openBrowser(...args);
export const selectComposition = (...args) => globalThis.renderMocks.selectComposition(...args);
export const renderMedia = (...args) => globalThis.renderMocks.renderMedia(...args);`;
registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === '@remotion/bundler' || specifier === '@remotion/renderer') {
        return { url: 'data:text/javascript,' + encodeURIComponent(mockModule), shortCircuit: true };
    }
    return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
}});
const { POST } = await import('../app/api/render/route.ts');
const clips = [{ id: 'title', type: 'text', trackId: 0, startFrame: 0, durationInFrames: 90, content: 'Hello' }];

async function setup(t, failure) {
    const cwd = await mkdtemp(path.join(tmpdir(), 'omoti-render-test-'));
    t.mock.method(process, 'cwd', () => cwd);
    t.mock.method(console, 'log', () => {});
    t.mock.method(console, 'error', () => {});
    t.after(() => rm(cwd, { recursive: true, force: true }));
    await mkdir(path.join(cwd, 'public'));
    const calls = [];
    let bundleOptions;
    const browser = { close: async () => { calls.push('close'); } };
    const fail = phase => { if (failure === phase) throw new Error(phase + ' failed'); };
    globalThis.renderMocks = {
        bundle: async options => {
            calls.push('bundle'); bundleOptions = options;
            assert.deepEqual(await readdir(options.publicDir), []);
            assert.notEqual(options.publicDir, path.join(cwd, 'public'));
            fail('bundle');
            await mkdir(options.outDir);
            return options.outDir;
        },
        openBrowser: async () => { calls.push('open'); fail('open'); return browser; },
        selectComposition: async options => {
            calls.push('select'); fail('select');
            assert.equal(options.puppeteerInstance, browser);
            assert.deepEqual(options.inputProps.clips, clips);
            assert.equal(options.inputProps.assetBaseUrl, 'http://assets:3000');
            return { id: 'MainVideo', durationInFrames: 300, fps: 30, width: 1280, height: 720 };
        },
        renderMedia: async options => {
            calls.push('render'); fail('render');
            assert.equal(options.puppeteerInstance, browser);
            assert.equal(options.codec, 'h264');
            assert.equal(options.crf, 20);
            assert.equal(options.pixelFormat, 'yuv420p');
            assert.equal(options.inputProps.assetBaseUrl, 'http://assets:3000');
            await writeFile(options.outputLocation, 'video');
        },
    };
    const request = body => new Request('http://localhost/api/render', { method: 'POST', body: JSON.stringify(body) });
    return { calls, request, cwd, getWorkDir: () => bundleOptions && path.dirname(bundleOptions.outDir) };
}

test('export skips media copies, shares a browser and removes its temporary bundle', async t => {
    const run = await setup(t);
    const result = await POST(run.request({ clips, assetBaseUrl: 'http://assets:3000' }));
    assert.equal(result.status, 200);
    assert.match((await result.json()).url, /^\/output\.mp4\?t=/);
    assert.deepEqual(run.calls, ['bundle', 'open', 'select', 'render', 'close']);
    await assert.rejects(stat(run.getWorkDir()), { code: 'ENOENT' });
    assert.equal((await stat(path.join(run.cwd, 'public/output.mp4'))).size, 5);
});

for (const phase of ['bundle', 'open', 'select', 'render']) {
    test(`failed ${phase} releases its browser and temporary files`, async t => {
        const run = await setup(t, phase);
        const result = await POST(run.request({ clips, assetBaseUrl: 'http://assets:3000' }));
        assert.equal(result.status, 500);
        assert.equal((await result.json()).error, phase + ' failed');
        assert.equal(run.calls.includes('close'), ['select', 'render'].includes(phase));
        await assert.rejects(stat(run.getWorkDir()), { code: 'ENOENT' });
    });
}

test('invalid clip input does not start export resources', async t => {
    const run = await setup(t);
    for (const body of [{}, { clips: null }, { clips: 'invalid' }]) {
        assert.equal((await POST(run.request(body))).status, 400);
    }
    assert.deepEqual(run.calls, []);
});
