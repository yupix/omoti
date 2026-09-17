import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arrangeGeneratedTracks, getTimelineIssues } from '../lib/generated-timeline.ts';
import { createSubtitleClips, getScriptIssues, splitSubtitlePages } from '../lib/ai-video.ts';

function clip(id, trackId, startFrame = 0, durationInFrames = 30) {
    return { id, trackId, startFrame, durationInFrames };
}

test('Track allocation handles simultaneous clips, adjacent boundaries and more than ten lanes', () => {
    const input = [clip('caption', 1), clip('caption-next', 1, 30),
        ...Array.from({ length: 12 }, (_, i) => clip(`overlay-${i}`, 3)),
        clip('background', 7, 0, 100)];
    const arranged = arrangeGeneratedTracks(input);
    assert.deepEqual(getTimelineIssues(arranged), []);
    assert.equal(arranged[0].trackId, arranged[1].trackId);
    assert.ok(arranged.at(-1).trackId > 10);
    assert.ok(arranged.slice(0, -1).every(item => item.trackId < arranged.at(-1).trackId));
    assert.deepEqual(arranged.map(({ id, startFrame, durationInFrames }) => ({ id, startFrame, durationInFrames })),
        input.map(({ id, startFrame, durationInFrames }) => ({ id, startFrame, durationInFrames })));
    assert.equal(input.at(-1).trackId, 7);
});

test('Timeline validation finds nested overlap and invalid timing without rejecting adjacent clips', () => {
    assert.equal(getTimelineIssues([clip('long', 1, 0, 100), clip('short', 1, 10), clip('nested', 1, 50)]).length, 2);
    assert.deepEqual(getTimelineIssues([clip('a', 1), clip('b', 1, 30)]), []);
    assert.ok(getTimelineIssues([clip('a', 1, -1), clip('a', 1, 0, 0)]).length >= 3);
    assert.ok(getTimelineIssues([clip('bad', 1, 0, Infinity)]).length);
    assert.deepEqual(arrangeGeneratedTracks([]), []);
});

test('Subtitles split at line and page boundaries without losing graphemes', () => {
    for (const length of [1, 32, 33, 64, 65, 320]) {
        const text = 'あ'.repeat(length);
        const pages = splitSubtitlePages(text);
        assert.equal(pages.length, Math.ceil(length / 64));
        assert.equal(pages.join('').replaceAll('\n', ''), text);
        assert.ok(pages.every(page => page.split('\n').length <= 2));
    }
    const emoji = '👨‍👩‍👧‍👦';
    assert.equal(splitSubtitlePages(emoji.repeat(33))[0], emoji.repeat(32) + '\n' + emoji);
    assert.deepEqual(splitSubtitlePages('前半\r\n後半'), ['前半\n後半']);
    assert.deepEqual(splitSubtitlePages(''), []);
});

test('Subtitle pages exactly cover audio timing even at rounding boundaries', () => {
    for (const frames of [3, 4, 100, 101]) {
        const clips = createSubtitleClips('あ'.repeat(129), 90, frames, 0);
        assert.equal(clips[0].startFrame, 90);
        assert.equal(clips.at(-1).startFrame + clips.at(-1).durationInFrames, 90 + frames);
        assert.deepEqual(getTimelineIssues(clips), []);
        clips.slice(1).forEach((item, index) => assert.equal(item.startFrame, clips[index].startFrame + clips[index].durationInFrames));
    }
    assert.throws(() => createSubtitleClips('あ'.repeat(129), 0, 2, 0), /Not enough frames/);
});

function script(overlays) {
    return { title: 'Test', scenes: [{ text: '台本', action: 'intro', overlays }] };
}

test('Layout validator distinguishes intentional backgrounds from overlapping text and subtitle intrusion', () => {
    const a = { type: 'text', content: 'A', x: 0, y: 0, width: 200, height: 100 };
    assert.deepEqual(getScriptIssues(script([a, { ...a, x: 200 }])), []);
    assert.match(getScriptIssues(script([a, { ...a, x: 199 }])).join(' '), /overlap/);
    assert.deepEqual(getScriptIssues(script([a, { ...a, type: 'shape', content: 'rect' }])), []);
    assert.deepEqual(getScriptIssues(script([{ ...a, y: 460 }])), []);
    assert.match(getScriptIssues(script([{ ...a, y: 461 }])).join(' '), /reserved for subtitles/);
    assert.ok(getScriptIssues(script([{ ...a, x: -1 }])).length);
    assert.ok(getScriptIssues(script([{ ...a, width: 1281 }])).length);
    assert.ok(getScriptIssues(script([{ ...a, content: 'あ'.repeat(100) }])).length);
    assert.ok(getScriptIssues(script([{ ...a, keyframes: { y: [{ frame: 30, value: 600 }] } }])).length);
    assert.ok(getScriptIssues({ title: 'Empty', scenes: [] }).length);
});


test('Separating tracks preserves the visual stacking of overlapping shapes and text', () => {
    const input = [clip('card', 3, 0, 100), clip('label', 3, 0, 40), clip('later-label', 3, 50, 40)];
    const result = arrangeGeneratedTracks(input);
    assert.deepEqual(getTimelineIssues(result), []);
    assert.ok(result[0].trackId > result[1].trackId);
    assert.ok(result[0].trackId > result[2].trackId);
    assert.equal(result[1].trackId, result[2].trackId);
});

test('Captions keep short English identifiers and punctuation attached across line breaks', () => {
    const text = 'あ'.repeat(29) + 'propsを渡します。';
    assert.deepEqual(splitSubtitlePages(text), ['あ'.repeat(29) + '\npropsを渡します。']);
    const punctuated = 'あ'.repeat(32) + '。次の文';
    assert.deepEqual(splitSubtitlePages(punctuated), ['あ'.repeat(31) + '\nあ。次の文']);
    const emoji = '👨‍👩‍👧‍👦';
    assert.equal(splitSubtitlePages(emoji.repeat(32) + '。')[0], emoji.repeat(31) + '\n' + emoji + '。');
});

test('Reserved panels include code, preview and characters for either side', async () => {
    const { getSceneLayout } = await import('../lib/ai-video.ts');
    for (const hasTachie of [false, true]) for (const position of ['left', 'right', 'center']) {
        const scene = { text: '説明', action: 'code', position, codeBlocks: [{ code: 'const value = 1;' }], previewContent: '<p>1</p>' };
        const layout = getSceneLayout(scene, hasTachie);
        const boxes = [...layout.code, layout.preview, layout.character].filter(Boolean);
        for (const [index, a] of boxes.entries()) {
            assert.ok(a.x >= 0 && a.x + a.width <= 1280 && a.y >= 120 && a.y + a.height <= 540);
            for (const b of boxes.slice(index + 1)) assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
            const overlay = { type: 'text', content: '見出し', ...a, width: 100, height: 40 };
            assert.match(getScriptIssues({ title: 'Test', scenes: [{ ...scene, overlays: [overlay] }] }, hasTachie).join(' '), /overlaps the .* panel/);
        }
        assert.deepEqual(getScriptIssues({ title: 'Test', scenes: [{ ...scene, overlays: [{ type: 'text', content: '親 → props → 子', x: 440, y: 32, width: 760, height: 60 }] }] }, hasTachie), []);
    }
});

test('Unreadable text effects and excessive code are returned to the AI', () => {
    const input = script([{ type: 'text', content: 'コンポーネント', width: 400, height: 80, effects: [{ type: 'outline' }] }]);
    assert.match(getScriptIssues(input).join(' '), /without outline/);
    const code = { title: 'Code', scenes: [{ text: '説明', action: 'code', codeBlocks: [{ code: 'const value = 1;\n'.repeat(13) }] }] };
    assert.match(getScriptIssues(code).join(' '), /panel capacity/);
});

test('Unverifiable transforms are returned to the AI instead of bypassing panel checks', () => {
    const input = script([{ type: 'text', content: 'Label', width: 200, height: 80, keyframes: { scale: [{ frame: 0, value: 3 }] } }]);
    assert.match(getScriptIssues(input).join(' '), /occupied area can be validated/);
    input.scenes[0].overlays = [];
    input.scenes[0].keyframes = { x: [{ frame: 0, value: 1200 }] };
    assert.match(getScriptIssues(input, true).join(' '), /reserved panel/);
});
