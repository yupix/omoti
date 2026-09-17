import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getClipFontRequests, loadClipFonts } from '../remotion/fonts.ts';

const clip = { id: 'text', type: 'text', trackId: 0, startFrame: 0, durationInFrames: 90, content: '日本語' };

test('system fonts and non-text clips do not preload the font catalog', async () => {
    assert.deepEqual(getClipFontRequests(clip), []);
    assert.deepEqual(getClipFontRequests({ ...clip, type: 'tachie' }), []);
    assert.deepEqual(getClipFontRequests({ ...clip, style: { fontFamily: 'sans-serif, unknown' } }), []);
    await loadClipFonts(clip);
});

test('Japanese text loads only its family, weight and required glyph subsets', () => {
    for (const weight of [400, 600, 800, 900]) {
        const requests = getClipFontRequests({ ...clip, style: { fontFamily: "'Noto Sans JP', sans-serif", fontWeight: weight } });
        assert.equal(requests.length, 1);
        assert.equal(requests[0].info.fontFamily, 'Noto Sans JP');
        assert.deepEqual(requests[0].weights, [String(weight)]);
        assert.ok(requests[0].subsets.length > 0);
        assert.ok(requests[0].subsets.length < 10);
    }
    const [defaultWeight] = getClipFontRequests({ ...clip, style: { fontFamily: 'Noto Sans JP' } });
    assert.deepEqual(defaultWeight.weights, ['800']);
});

test('fallback weights, code headers and flow labels retain their font choices', () => {
    const [fallback] = getClipFontRequests({ ...clip, content: 'Hello', style: { fontFamily: 'Inter', fontWeight: 800 } });
    assert.deepEqual(fallback.weights, ['400', '600', '700']);
    assert.deepEqual(fallback.subsets, ['latin']);
    const [header] = getClipFontRequests({ ...clip, type: 'code' });
    assert.equal(header.info.fontFamily, 'Inter');
    assert.deepEqual(header.weights, ['400']);
    const [flow] = getClipFontRequests({ ...clip, type: 'flow', nodes: [{ style: { fontFamily: 'Noto Serif JP', fontWeight: 'bold' } }] });
    assert.equal(flow.info.fontFamily, 'Noto Serif JP');
    assert.deepEqual(flow.weights, ['700']);
    const repeated = getClipFontRequests({ ...clip, style: { fontFamily: 'Noto Sans JP, "Noto Sans JP"' } });
    assert.equal(repeated.length, 1);
});


test('font subsets follow text edits, supplementary characters and empty text', () => {
    const sample = { ...clip, style: { fontFamily: 'Noto Sans JP', fontWeight: 800 } };
    const latin = getClipFontRequests({ ...sample, content: 'Hello' })[0];
    assert.ok(latin.subsets.includes('latin'));
    assert.ok(!latin.subsets.includes('[0]'));
    const cjk = getClipFontRequests({ ...sample, content: String.fromCodePoint(0x25ee8) })[0];
    assert.ok(cjk.subsets.includes('[0]'));
    assert.deepEqual(getClipFontRequests({ ...sample, content: '' })[0].subsets, []);
    const edited = getClipFontRequests({ ...sample, content: 'あいうえお' })[0];
    assert.ok(edited.subsets.includes('[119]'));
    assert.ok(!edited.subsets.includes('[0]'));
});
