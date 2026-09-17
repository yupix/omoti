import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier === './psd-structure') return nextResolve(new URL('../lib/psd-structure.ts', import.meta.url).href, context);
    if (specifier === '../remotion/utils') return nextResolve(new URL('../remotion/utils.ts', import.meta.url).href, context);
    return nextResolve(specifier, context);
} });
const { drawPsd, loadPsd } = await import('../lib/psd.ts');
const { resolveAssetUrl } = await import('../remotion/utils.ts');

test('Legacy local upload URLs use the current app/export server while external media keep their host', () => {
    assert.equal(resolveAssetUrl('http://localhost:3000/uploads/avatar.psd', 'http://server:3000'), 'http://server:3000/uploads/avatar.psd');
    assert.equal(resolveAssetUrl('/uploads/avatar.psd', 'http://server:3000'), 'http://server:3000/uploads/avatar.psd');
    assert.equal(resolveAssetUrl('https://example.com/uploads/avatar.psd', 'http://server:3000'), 'https://example.com/uploads/avatar.psd');
    assert.equal(resolveAssetUrl('data:image/png;base64,abc', 'http://server'), 'data:image/png;base64,abc');
});

test('Concurrent PSD readers share a request and a failed download can be retried', async t => {
    let attempts = 0;
    let finish;
    t.mock.method(globalThis, 'fetch', () => { attempts++; return new Promise(resolve => { finish = resolve; }); });
    const first = loadPsd('/uploads/retry.psd');
    const second = loadPsd('/uploads/retry.psd');
    const metadata = loadPsd('/uploads/retry.psd', undefined, true);
    assert.equal(first, second);
    assert.equal(first, metadata);
    assert.equal(attempts, 1);
    finish(new Response(null, { status: 404 }));
    await assert.rejects(first, /PSDが見つかりません/);
    const retry = loadPsd('/uploads/retry.psd');
    assert.equal(attempts, 2);
    finish(new Response(null, { status: 503 }));
    await assert.rejects(retry, /HTTP 503/);
});

test('Mandatory folders draw visible descendants; hidden groups and mouth alternatives stay hidden', () => {
    const layer = (name, hidden = false) => ({ name, hidden, canvas: { name }, left: 0, top: 0 });
    const psd = { width: 10, height: 10, children: [
        { name: 'body', children: [layer('shirt'), layer('alternate', true)] },
        { name: 'hidden', hidden: true, children: [layer('not visible')] },
        { name: 'face', children: [layer('closed'), layer('open', true)] },
    ] };
    const drawn = [];
    const ctx = { clearRect() { drawn.length = 0; }, drawImage(canvas) { drawn.push(canvas.name); }, globalAlpha: 1 };
    drawPsd(ctx, psd, {});
    assert.deepEqual(drawn, ['shirt', 'closed']);
    const config = { tachieLayers: ['face/closed'], mandatoryLayers: ['body'], mouthOpenLayers: ['face/open'], mouthClosedLayers: ['face/closed'] };
    drawPsd(ctx, psd, config, false);
    assert.deepEqual(drawn, ['shirt', 'closed']);
    drawPsd(ctx, psd, config, true);
    assert.deepEqual(drawn, ['shirt', 'open']);
    assert.equal(ctx.globalAlpha, 1);
});

test('AI selections resolve slash and duplicate names to exactly the intended pixels', async () => {
    const { describePsd, resolveCharacterLayers } = await import('../lib/psd-structure.ts');
    const pixel = (name, marker, hidden = false) => ({ name, canvas: { marker }, hidden, left: 0, top: 0, right: 1, bottom: 1 });
    const psd = { width: 1, height: 1, children: [
        pixel('body', 'body'),
        { name: 'face', children: [pixel('///', 'slashes', true), pixel('same', 'first', true), pixel('same', 'second', true)] },
    ] };
    const structure = describePsd(psd);
    const config = { neutral: [structure.nodes[2].id, structure.nodes[4].id], mouthOpen: [], mouthClosed: [] };
    const selection = resolveCharacterLayers({ name: 'Character', structure }, config, 'neutral');
    const drawn = [];
    drawPsd({ clearRect() {}, drawImage(canvas) { drawn.push(canvas.marker); }, globalAlpha: 1 }, psd, selection);
    assert.deepEqual(drawn, ['body', 'slashes', 'second']);
});
