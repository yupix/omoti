import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';
registerHooks({ resolve(specifier, context, nextResolve) {
    return nextResolve(specifier === './generated-timeline' ? './generated-timeline.ts' : specifier, context);
} });
const { applyEditPlan, editPlanSchema, editorProjectSchema, getEditChanges, sameProject, MAX_EDIT_CLIPS } = await import('../lib/ai-edit.ts');
const { recordHistory } = await import('../lib/editor-history.ts');
const textClip = (id = 'caption', extra = {}) => ({ id, type: 'text', trackId: 1, startFrame: 0, durationInFrames: 90, content: '元の字幕', x: 100, y: 580, width: 1080, height: 100, ...extra });
const project = (clips = [textClip()]) => ({ clips, tracks: [...new Set(clips.map(c => c.trackId))].map(id => ({ id, name: `Track ${id}` })), primaryColor: '#123456' });
const plan = (...operations) => ({ summary: '編集案', operations });
const update = (clipId = 'caption', patch = { content: '新しい字幕' }) => ({ type: 'update', clipId, patch, reason: '依頼された変更' });
const addition = (extra = {}) => ({ type: 'add', clip: textClip('new', { startFrame: 90, ...extra }), reason: '見出しを追加' });

test('partial edits preserve media, PSD/lip-sync, flow and unrequested fields without mutation', () => {
    const caption = textClip('caption', { style: { color: '#000', backgroundColor: '#fff', padding: 5 }, keyframes: { x: [{ frame: 0, value: 100 }], opacity: [{ frame: 0, value: 1 }] } });
    const psd = { ...textClip('psd', { trackId: 2, type: 'tachie', content: '/uploads/character.psd', x: 0, y: 0, width: 300, height: 500 }), tachieLayers: ['body', 'happy'], audioUrl: '/uploads/speech.wav', mouthOpenLayers: ['open'], mouthClosedLayers: ['closed'], mandatoryLayers: ['body'], crop: { left: 1, top: 2, right: 3, bottom: 4 } };
    const flow = textClip('flow', { type: 'flow', trackId: 3, content: '', nodes: [{ id: 'node' }], edges: [] });
    const base = project([caption, psd, flow]);
    const saved = structuredClone(base);
    const result = applyEditPlan(base, plan(update('caption', { content: '新しい字幕', style: { color: '#f00', padding: null }, keyframes: { x: null } }), update('psd', { x: 20 })));
    assert.deepEqual(base, saved);
    assert.deepEqual(result.clips[0].style, { color: '#f00', backgroundColor: '#fff' });
    assert.deepEqual(result.clips[0].keyframes, { opacity: [{ frame: 0, value: 1 }] });
    assert.deepEqual(result.clips[1], { ...psd, x: 20 });
    assert.equal(result.clips[2], flow);
    assert.deepEqual(result.tracks, base.tracks);
});

test('selected scope permits only the requested clip, including deletion', () => {
    const base = project([textClip(), textClip('other', { startFrame: 90 })]);
    assert.equal(applyEditPlan(base, plan(update()), ['caption']).clips[0].content, '新しい字幕');
    assert.throws(() => applyEditPlan(base, plan(update('other')), ['caption']), /outside the selected/);
    assert.throws(() => applyEditPlan(base, plan(addition()), ['caption']), /outside the selected/);
    for (const selection of [[], ['missing']]) assert.throws(() => applyEditPlan(base, plan(update()), selection), /no longer exists/);
    assert.deepEqual(applyEditPlan(base, plan({ type: 'delete', clipId: 'caption', reason: '削除' }), ['caption']).clips, [base.clips[1]]);
});

test('new tracks keep existing track IDs, names and stacking order', () => {
    const base = project();
    const result = applyEditPlan(base, plan(addition({ trackId: 9, startFrame: 0, y: 30 })));
    assert.deepEqual(result.tracks, [...base.tracks, { id: 9, name: 'AI 9' }]);
    assert.equal(result.clips[0], base.clips[0]);
});

test('rejects nonexistent IDs, duplicate operations, duplicate additions and empty changes', () => {
    for (const edit of [plan(update('missing')), plan(update(), update()), plan(addition({ id: 'caption' })), plan(update('caption', {})), plan(update('caption', { content: '元の字幕' })), plan()]) {
        assert.throws(() => applyEditPlan(project(), edit));
    }
});

test('rejects unsafe timing, geometry, text overlap and invalid keyframes', () => {
    for (const patch of [{ startFrame: -1 }, { durationInFrames: 0 }, { durationInFrames: 0.5 }, { x: 1279 }, { y: -1 }, { width: 0 }, { animation: { type: 'fade', duration: 100 } }, { keyframes: { x: [{ frame: 2, value: 100 }, { frame: 2, value: 200 }] } }, { keyframes: { x: [{ frame: 0, value: 1500 }] } }, { content: '長文'.repeat(500) }]) {
        assert.throws(() => applyEditPlan(project(), plan(update('caption', patch))), JSON.stringify(patch));
    }
    assert.throws(() => applyEditPlan(project(), plan(addition({ startFrame: 30, y: 20 }))), /overlap/i);
    assert.throws(() => applyEditPlan(project(), plan(addition({ startFrame: 0, trackId: 2 }))), /text overlaps/);
});

test('media sources and unrelated structured data cannot be replaced by AI output', () => {
    const base = project([textClip('media', { type: 'tachie', content: '/real.psd' })]);
    assert.throws(() => applyEditPlan(base, plan(update('media', { content: '/invented.psd' }))), /must be preserved/);
    for (const patch of [{ tachieLayers: ['invented'] }, { audioUrl: '/invented.wav' }, { type: 'text' }, { nodes: [] }, { style: { background: 'url(https://example.com)' } }]) {
        assert.throws(() => applyEditPlan(base, plan(update('media', patch))));
    }
    assert.throws(() => applyEditPlan(project(), plan(addition({ type: 'image', content: '/invented.png' }))));
});

test('code edits must explicitly handle the steps that override content', () => {
    const base = project([textClip('code', { type: 'code', steps: [{ code: 'old()', frameOffset: 0 }] })]);
    assert.throws(() => applyEditPlan(base, plan(update('code', { content: 'new()' }))), /steps override/);
    const result = applyEditPlan(base, plan(update('code', { content: 'new()', steps: null })));
    assert.equal(result.clips[0].content, 'new()');
    assert.equal(result.clips[0].steps, undefined);
});

test('clip count limits accept the boundary and reject one more addition or input clip', () => {
    const base = project(Array.from({ length: MAX_EDIT_CLIPS }, (_, i) => textClip(`c${i}`, { startFrame: i * 90 })));
    assert.equal(editorProjectSchema.safeParse(base).success, true);
    assert.equal(applyEditPlan(base, plan(update('c0'))).clips.length, MAX_EDIT_CLIPS);
    assert.throws(() => applyEditPlan(base, plan(addition({ startFrame: MAX_EDIT_CLIPS * 90 }))), /at most/);
    assert.equal(editorProjectSchema.safeParse({ ...base, clips: [...base.clips, textClip('extra')] }).success, false);
    assert.equal(editPlanSchema.safeParse(plan(...Array.from({ length: MAX_EDIT_CLIPS + 1 }, (_, i) => update(`c${i}`)))).success, false);
});

test('project snapshots detect changes to tracks, PSD fields and clips', () => {
    const base = project();
    assert.ok(sameProject(base, structuredClone(base)));
    for (const changed of [{ ...base, primaryColor: '#fff' }, { ...base, tracks: [{ id: 1, name: 'Renamed' }] }, { ...base, clips: [textClip('caption', { tachieLayers: ['happy'] })] }]) assert.equal(sameProject(base, changed), false);
});

test('review changes contain actual text, style values and additions/deletions', () => {
    const base = project();
    const changes = getEditChanges(base, plan(update('caption', { content: '短く', style: { color: '#fff' } }), addition()));
    assert.deepEqual(changes[0].fields[0], { field: 'content', before: '元の字幕', after: '短く' });
    assert.equal(changes[0].fields[1].field, 'color');
    assert.equal(changes[1].fields.find(f => f.field === 'content').after, '元の字幕');
    assert.equal(getEditChanges(base, plan({ type: 'delete', clipId: 'caption', reason: '削除' }))[0].fields.find(f => f.field === 'content').before, '元の字幕');
});

test('history captures the complete AI edit immediately, including an unsaved manual change', () => {
    const first = project();
    const manual = project([textClip('caption', { content: '手動修正' })]);
    const edited = applyEditPlan(manual, plan(update()));
    const history = recordHistory([first], 0, manual, edited);
    assert.deepEqual(history.states[history.index - 1], manual);
    assert.deepEqual(history.states[history.index], edited);
    assert.equal(recordHistory(history.states, history.index, edited).states.length, 3);
    const afterUndo = recordHistory(history.states, history.index - 1, manual, first);
    assert.deepEqual(afterUndo.states, [first, manual, first]);
});

test('history caps at 50 states without losing immediate undo/redo snapshots', () => {
    const states = Array.from({ length: 50 }, (_, i) => project([textClip('caption', { content: `字幕${i}` })]));
    const manual = project([textClip('caption', { content: '手動' })]);
    const edited = applyEditPlan(manual, plan(update()));
    const result = recordHistory(states, 49, manual, edited);
    assert.equal(result.states.length, 50);
    assert.equal(result.index, 49);
    assert.deepEqual(result.states[48], manual);
    assert.deepEqual(result.states[49], edited);
});


test('track limit rejects a new track at capacity but allows reuse of a free track', () => {
    const base = { ...project(), tracks: Array.from({ length: MAX_EDIT_CLIPS }, (_, i) => ({ id: i + 1, name: `Track ${i + 1}` })) };
    assert.throws(() => applyEditPlan(base, plan(addition({ trackId: MAX_EDIT_CLIPS + 1 }))), /at most 1000 tracks/);
    assert.equal(applyEditPlan(base, plan(addition({ trackId: 2 }))).tracks.length, MAX_EDIT_CLIPS);
});
