import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, test } from 'node:test';
registerHooks({ resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) return nextResolve(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
    return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier === './generated-timeline' ? './generated-timeline.ts' : specifier, context);
} });
const { POST } = await import('../app/api/ai/edit/route.ts');
const { MAX_EDIT_REQUEST_CHARS } = await import('../lib/ai-edit.ts');
const project = { primaryColor: '#123456', tracks: [{ id: 1, name: '字幕' }], clips: [
    { id: 'caption', type: 'text', content: '元の字幕', trackId: 1, startFrame: 0, durationInFrames: 90, x: 100, y: 580, width: 1080, height: 100 },
    { id: 'next', type: 'text', content: '次の字幕', trackId: 1, startFrame: 90, durationInFrames: 90, x: 100, y: 580, width: 1080, height: 100 },
] };
const plan = { summary: '字幕を短くしました。', operations: [{ type: 'update', clipId: 'caption', patch: { content: '短い字幕' }, reason: '読みやすくする' }] };
const envNames = ['CMD_API_KEY', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'GEMINI_API_KEY', 'GOOGLE_API_KEY'];
let savedEnv;
beforeEach(t => {
    savedEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
    for (const name of envNames) delete process.env[name];
    process.env.OPENAI_BASE_URL = 'https://openai.invalid/v1';
    t.mock.method(globalThis, 'fetch', () => { throw new Error('Unexpected provider call'); });
});
afterEach(() => { for (const name of envNames) { if (savedEnv[name] === undefined) delete process.env[name]; else process.env[name] = savedEnv[name]; } });
function edit(options = {}, signal) {
    return POST(new Request('http://localhost/api/ai/edit', { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: '字幕を短くして', project, currentFrame: 42, provider: 'commandcode', apiKey: 'test-key', ...options }) }));
}
function mockApi(t, contents, status = 200) {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        const request = new Request(url, init);
        const body = await request.json();
        calls.push({ url: request.url, body });
        const output = contents[Math.min(calls.length - 1, contents.length - 1)];
        const text = typeof output === 'string' ? output : JSON.stringify(output);
        if (status !== 200) return Response.json({ error: { message: 'provider rejected the request' } }, { status });
        if (request.url.includes('generativelanguage')) return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }] });
        if (request.url.endsWith('/messages')) return Response.json({ content: [{ type: 'text', text }] });
        return Response.json({ choices: [{ message: { content: text } }] });
    });
    return calls;
}

test('editing sends the existing timeline, selection and playhead to each supported provider', async t => {
    for (const options of [{ provider: 'openai' }, { provider: 'gemini' }, { provider: 'commandcode' }, { provider: 'commandcode', model: 'claude-sonnet-4-6' }]) {
        const calls = mockApi(t, [plan]);
        const response = await edit({ ...options, selectedIds: ['caption'] });
        assert.equal(response.status, 200, JSON.stringify(await response.clone().json()));
        assert.deepEqual((await response.json()).plan, plan);
        assert.equal(calls.length, 1);
        const body = calls[0].body;
        const context = JSON.parse(body.contents?.[0].parts[0].text || body.messages.find(m => m.role === 'user').content);
        assert.deepEqual(context.project, project);
        assert.deepEqual(context.selectedIds, ['caption']);
        assert.equal(context.currentFrame, 42);
        assert.equal(context.instruction, '字幕を短くして');
    }
});

test('overlapping edits are returned to the model and repaired before offering a plan', async t => {
    const broken = { ...plan, operations: [{ ...plan.operations[0], patch: { durationInFrames: 100 } }] };
    const calls = mockApi(t, [broken, plan]);
    const response = await edit();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).repairAttempts, 1);
    assert.equal(calls.length, 2);
    assert.match(calls[1].body.messages.at(-1).content, /overlap/i);
    assert.deepEqual(JSON.parse(calls[1].body.messages.at(-2).content), broken);
    assert.deepEqual(JSON.parse(calls[1].body.messages[1].content).project, project);
});

test('malformed JSON, unknown clip IDs and out-of-scope plans can be repaired', async t => {
    const invalid = { ...plan, operations: [{ ...plan.operations[0], clipId: 'missing' }] };
    const outside = { ...plan, operations: [{ ...plan.operations[0], clipId: 'next' }] };
    const calls = mockApi(t, ['not JSON', invalid, outside, '```json\n' + JSON.stringify(plan) + '\n```']);
    const response = await edit({ selectedIds: ['caption'] });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).repairAttempts, 3);
    assert.match(calls[2].body.messages.at(-1).content, /outside the selected/);
    assert.match(calls[3].body.messages.at(-1).content, /outside the selected/);
});

test('unresolved validation errors exhaust three repairs and return no plan', async t => {
    const calls = mockApi(t, [{ ...plan, operations: [{ ...plan.operations[0], patch: { startFrame: 90 } }] }]);
    const response = await edit();
    assert.equal(response.status, 422);
    const data = await response.json();
    assert.equal(data.plan, undefined);
    assert.ok(data.issues.some(issue => /overlap/i.test(issue)));
    assert.equal(calls.length, 4);
});

test('invalid or empty inputs and missing keys fail without calling a provider', async () => {
    for (const options of [{ prompt: '' }, { project: { ...project, clips: [] } }, { selectedIds: ['missing'] }, { selectedIds: [] }, { provider: 'invalid' }, { apiKey: '' }, { currentFrame: -1 }, { project: { ...project, tracks: [] } }]) {
        assert.equal((await edit(options)).status, 400, JSON.stringify(options));
    }
    assert.equal((await POST(new Request('http://localhost/api/ai/edit', { method: 'POST', body: 'invalid' }))).status, 400);
});

test('request size limit accepts the exact boundary and rejects one character over', async t => {
    const body = { prompt: '字幕を短くして', project: structuredClone(project), provider: 'commandcode', apiKey: 'test-key' };
    body.project.clips[0].content = '';
    body.project.clips[0].content = 'a'.repeat(MAX_EDIT_REQUEST_CHARS - JSON.stringify(body).length);
    const send = () => POST(new Request('http://localhost/api/ai/edit', { method: 'POST', body: JSON.stringify(body) }));
    const calls = mockApi(t, [plan]);
    assert.equal(JSON.stringify(body).length, MAX_EDIT_REQUEST_CHARS);
    assert.equal((await send()).status, 200);
    body.project.clips[0].content += 'a';
    assert.equal((await send()).status, 413);
    assert.equal(calls.length, 1);
});

test('authentication and temporary provider failures return errors without replacement or repair', async t => {
    for (const provider of ['commandcode', 'gemini']) {
        for (const status of [401, 429, 503]) {
            const calls = mockApi(t, [plan], status);
            const response = await edit({ provider });
            assert.equal(response.status, status, `${provider} ${status}`);
            assert.equal((await response.json()).plan, undefined);
            assert.equal(calls.length, 1);
        }
    }
});

test('cancelled requests never send or return an edit plan', async t => {
    const controller = new AbortController();
    controller.abort();
    assert.equal((await edit({}, controller.signal)).status, 499);
    const pending = new AbortController();
    t.mock.method(globalThis, 'fetch', async () => {
        pending.abort();
        return Response.json({ choices: [{ message: { content: JSON.stringify(plan) } }] });
    });
    const response = await edit({}, pending.signal);
    assert.equal(response.status, 499);
    assert.equal((await response.json()).plan, undefined);
});

test('valid partial edits of normal editor state do not trigger unrelated AI repairs', async t => {
    const existing = structuredClone(project);
    Object.assign(existing.clips[0], { x: -20, animation: { type: 'fade', duration: 500 }, keyframes: { x: [{ frame: 30, value: 100 }, { frame: 10, value: -20 }] } });
    const saved = structuredClone(existing);
    const calls = mockApi(t, [plan]);
    const response = await edit({ project: existing, selectedIds: ['caption'] });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.plan, plan);
    assert.equal(data.repairAttempts, 0);
    assert.equal(calls.length, 1);
    assert.deepEqual(existing, saved);
});
