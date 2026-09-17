import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { afterEach, beforeEach, test } from 'node:test';

// Next.js resolves this extensionless import when it runs the route.
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('@/')) return nextResolve(new URL('../' + specifier.slice(2) + '.ts', import.meta.url).href, context);
        return nextResolve(specifier === 'next/server' ? 'next/server.js' : specifier, context);
    },
});
const { POST } = await import('../app/api/ai/generate/route.ts');

const script = {
    title: 'Generated video',
    scenes: [{
        text: '生成した台本です。',
        action: 'intro',
        overlays: [{ type: 'text', content: 'Extra caption', layer: 'foreground' }],
    }],
};
const prompt = '短い動画を作って';
const envNames = ['CMD_API_KEY', 'OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID'];
let savedEnv;

beforeEach((t) => {
    savedEnv = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
    delete process.env.CMD_API_KEY;
    process.env.OPENAI_API_KEY = 'openai-test-key';
    process.env.OPENAI_BASE_URL = 'https://openai.invalid/v1';
    process.env.OPENAI_ORG_ID = 'openai-test-org';
    process.env.OPENAI_PROJECT_ID = 'openai-test-project';
    t.mock.method(globalThis, 'fetch', () => {
        throw new Error('Unexpected network request');
    });
});

afterEach(() => {
    for (const name of envNames) {
        if (savedEnv[name] === undefined) delete process.env[name];
        else process.env[name] = savedEnv[name];
    }
});

function mockApi(t, response, status = 200) {
    const calls = [];
    calls.voiceRequests = 0;
    t.mock.method(globalThis, 'fetch', async (url, init) => {
        const request = new Request(url, init);
        if (request.url.startsWith('http://127.0.0.1:50021/audio_query?')) {
            calls.voiceRequests++;
            return new Response(null, { status: 503 });
        }
        assert.ok(['api.commandcode.ai', 'openai.invalid', 'generativelanguage.googleapis.com'].includes(new URL(request.url).hostname));
        calls.push({ url: request.url, headers: request.headers, body: await request.json() });
        if (response instanceof Error) throw response;
        return Response.json(Array.isArray(response) ? response[Math.min(calls.length - 1, response.length - 1)] : response, { status });
    });
    return calls;
}

function generate(options = {}) {
    return POST(new Request('http://localhost/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider: 'commandcode', apiKey: 'cmd-test-key', ...options }),
    }));
}

function chatResponse(content = JSON.stringify(script)) {
    return { choices: [{ message: { content } }] };
}

test('Command Code uses its own endpoint/key and preserves generated clips', async (t) => {
    process.env.CMD_API_KEY = 'server-key';
    const calls = mockApi(t, chatResponse());
    const response = await generate({ apiKey: '  cmd-test-key  ' });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.ok(data.clips.some(clip => clip.content === script.title));
    assert.ok(data.clips.some(clip => clip.content === script.scenes[0].text));
    assert.ok(data.clips.some(clip => clip.content === 'Extra caption'));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.commandcode.ai/provider/v1/chat/completions');
    assert.equal(calls[0].headers.get('authorization'), 'Bearer cmd-test-key');
    assert.equal(calls[0].headers.get('openai-organization'), null);
    assert.equal(calls[0].headers.get('openai-project'), null);
    assert.equal(calls[0].body.model, 'deepseek/deepseek-v4-flash');
    assert.equal(calls[0].body.messages[0].role, 'system');
    assert.deepEqual(calls[0].body.messages[1], { role: 'user', content: prompt });
    assert.equal(calls[0].body.response_format, undefined);
});

test('Command Code uses CMD_API_KEY and accepts a custom model and fenced JSON', async (t) => {
    process.env.CMD_API_KEY = '  server-key  ';
    const calls = mockApi(t, chatResponse(' \n```json\n' + JSON.stringify(script) + '\n```\n '));
    assert.equal((await generate({ apiKey: ' ', model: ' moonshotai/Kimi-K2.5 ' })).status, 200);
    assert.equal(calls[0].headers.get('authorization'), 'Bearer server-key');
    assert.equal(calls[0].body.model, 'moonshotai/Kimi-K2.5');
});

test('Claude uses Messages API and joins text blocks without reasoning blocks', async (t) => {
    const content = JSON.stringify(script);
    const calls = mockApi(t, { content: [
        { type: 'thinking', thinking: 'Private reasoning' },
        { type: 'text', text: content.slice(0, 20) },
        { type: 'text', text: content.slice(20) },
    ] });
    assert.equal((await generate({ model: 'claude-sonnet-4-6' })).status, 200);
    assert.equal(calls[0].url, 'https://api.commandcode.ai/provider/v1/messages');
    assert.equal(calls[0].headers.get('authorization'), 'Bearer cmd-test-key');
    assert.equal(calls[0].headers.get('anthropic-version'), '2023-06-01');
    assert.equal(calls[0].body.model, 'claude-sonnet-4-6');
    assert.ok(calls[0].body.system.includes('video script generator'));
    assert.ok(calls[0].body.max_tokens > 0);
    assert.deepEqual(calls[0].body.messages, [{ role: 'user', content: prompt }]);
});

test('OpenAI retains its original model, key and JSON response format', async (t) => {
    const calls = mockApi(t, chatResponse());
    assert.equal((await generate({ provider: 'openai', apiKey: '', model: 'ignored' })).status, 200);
    assert.equal(calls[0].url, 'https://openai.invalid/v1/chat/completions');
    assert.equal(calls[0].headers.get('authorization'), 'Bearer openai-test-key');
    assert.equal(calls[0].body.model, 'gpt-4o');
    assert.deepEqual(calls[0].body.response_format, { type: 'json_object' });
});

test('Missing keys and invalid settings fail before any provider call', async () => {
    for (const options of [
        { apiKey: '' }, { apiKey: ' ' }, { apiKey: undefined },
        { apiKey: 123 }, { model: 123 }, { model: null },
        { provider: 'unknown' }, { prompt: '' },
    ]) {
        const response = await generate(options);
        assert.equal(response.status, 400);
        assert.ok((await response.json()).error);
    }
    assert.equal(globalThis.fetch.mock.callCount(), 0);
});

for (const model of ['deepseek/deepseek-v4-flash', 'claude-sonnet-4-6']) {
    test(`${model}: API errors surface instead of returning mock video clips`, async (t) => {
        for (const status of [400, 401, 403, 429, 503]) {
            const calls = mockApi(t, { error: { message: 'Provider rejected request' } }, status);
            const response = await generate({ model });
            assert.equal(response.status, status);
            const data = await response.json();
            assert.match(data.error, /Provider rejected request/);
            assert.equal(data.clips, undefined);
            assert.equal(calls.length, 1);
        }
    });
}

test('Empty, malformed and incomplete model responses do not create clips', async (t) => {
    for (const [model, responseBody] of [
        ['', chatResponse(null)],
        ['', { choices: [] }],
        ['', chatResponse('not json')],
        ['', chatResponse('{}')],
        ['', chatResponse(JSON.stringify({ title: 'Empty', scenes: [] }))],
        ['', chatResponse(JSON.stringify({ title: 'Bad scene', scenes: [{ action: 'intro' }] }))],
        ['claude-sonnet-4-6', { content: [] }],
        ['claude-sonnet-4-6', { content: [{ type: 'thinking', thinking: 'No answer' }] }],
    ]) {
        mockApi(t, responseBody);
        const response = await generate({ model });
        assert.ok([422, 502].includes(response.status));
        const data = await response.json();
        assert.ok(data.error);
        assert.equal(data.clips, undefined);
    }
});

test('Network failures and timeouts surface without retrying or generating mock clips', async (t) => {
    for (const error of [new TypeError('fetch failed'), new DOMException('Request timed out', 'AbortError')]) {
        const calls = mockApi(t, error);
        const response = await generate();
        assert.equal(response.status, 502);
        assert.ok((await response.json()).error);
        assert.equal(calls.length, 1);
    }
});

const overlappingScript = {
    ...script,
    scenes: [{ ...script.scenes[0], overlays: [
        { type: 'text', content: 'Card', x: 400, y: 100, width: 250, height: 100 },
        { type: 'text', content: 'Button', x: 600, y: 100, width: 250, height: 100 },
    ] }],
};
const fixedScript = {
    ...script,
    scenes: [{ ...script.scenes[0], overlays: [
        { type: 'text', content: 'Card', x: 400, y: 100, width: 180, height: 100 },
        { type: 'text', content: 'Button', x: 600, y: 100, width: 180, height: 100 },
    ] }],
};

for (const options of [{}, { provider: 'openai' }, { model: 'claude-sonnet-4-6' }, { provider: 'gemini' }]) {
    test(`Layout feedback repairs overlapping text: ${JSON.stringify(options)}`, async (t) => {
        const wrap = (value) => {
            const text = JSON.stringify(value);
            if (options.provider === 'gemini') return { candidates: [{ content: { role: 'model', parts: [{ text }] } }] };
            if (options.model) return { content: [{ type: 'text', text }] };
            return chatResponse(text);
        };
        const calls = mockApi(t, [wrap(overlappingScript), wrap(fixedScript)]);
        const response = await generate(options);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).repairAttempts, 1);
        assert.equal(calls.length, 2);
        assert.equal(calls.voiceRequests, 1);
        const history = calls[1].body.messages || calls[1].body.contents;
        assert.match(JSON.stringify(history), /text boxes overlap/);
        assert.ok(JSON.stringify(history).includes('Card'));
        assert.ok(JSON.stringify(history).includes(prompt));
    });
}

test('Unresolved layout stops at three repairs without synthesizing or importing clips', async (t) => {
    const calls = mockApi(t, chatResponse(JSON.stringify(overlappingScript)));
    const response = await generate();
    assert.equal(response.status, 422);
    const data = await response.json();
    assert.match(data.error, /3 repairs/);
    assert.match(data.issues.join(' '), /overlap/);
    assert.equal(data.clips, undefined);
    assert.equal(calls.length, 4);
    assert.equal(calls.voiceRequests, 0);
});

test('Long subtitles are paginated and all returned tracks are collision-free', async (t) => {
    const { getTimelineIssues } = await import('../lib/generated-timeline.ts');
    const text = 'Reactの大きな特徴は画面を小さな部品に分けて作ることです。'.repeat(8);
    mockApi(t, chatResponse(JSON.stringify({ ...fixedScript, scenes: [{ ...fixedScript.scenes[0], text }] })));
    const response = await generate();
    assert.equal(response.status, 200);
    const { clips } = await response.json();
    assert.deepEqual(getTimelineIssues(clips), []);
    const subtitles = clips.filter(clip => clip.title === 'Subtitle');
    const audio = clips.find(clip => clip.type === 'audio');
    assert.ok(subtitles.length > 1);
    assert.equal(subtitles.map(clip => clip.content.replaceAll('\n', '')).join(''), text);
    assert.equal(subtitles[0].startFrame, audio.startFrame);
    const last = subtitles.at(-1);
    assert.equal(last.startFrame + last.durationInFrames, audio.startFrame + audio.durationInFrames);
    for (const subtitle of subtitles) {
        assert.equal(subtitle.effects, undefined);
        assert.equal(subtitle.style.textShadow, 'none');
        assert.ok(subtitle.y + subtitle.height <= 720);
    }
});

test('AI gets code collision feedback and emitted panels use the validated geometry', async t => {
    const { getSceneLayout } = await import('../lib/ai-video.ts');
    const scene = { text: '親から子へpropsを渡します。', character: 'Character', action: 'code', codeBlocks: [{ code: 'const props = { name: "あかね" };', fileName: 'Greeting.jsx' }], overlays: [{ type: 'text', content: '親 → props → 子', x: 700, y: 140, width: 350, height: 50 }] };
    const fixed = { ...scene, overlays: [{ ...scene.overlays[0], y: 32 }] };
    const calls = mockApi(t, [chatResponse(JSON.stringify({ title: 'Props', tachieConfigs: { Character: { neutral: [], mouthOpen: [], mouthClosed: [] } }, scenes: [scene] })), chatResponse(JSON.stringify({ title: 'Props', tachieConfigs: { Character: { neutral: [], mouthOpen: [], mouthClosed: [] } }, scenes: [fixed] }))]);
    const response = await generate({ tachies: [{ name: 'Character', url: '/uploads/character.psd', structure: { width: 100, height: 100, nodes: [] } }] });
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.repairAttempts, 1);
    assert.match(JSON.stringify(calls[1].body.messages), /overlaps the codeBlocks/);
    const layout = getSceneLayout(fixed, true);
    const code = data.clips.find(clip => clip.type === 'code');
    assert.deepEqual({ x: code.x, y: code.y, width: code.width, height: code.height }, layout.code[0]);
    assert.equal(code.effects, undefined);
    const character = data.clips.find(clip => clip.type === 'tachie');
    assert.deepEqual(character.tachieLayers, [], 'must not inject another PSD’s hardcoded layers');
    assert.ok(character.y + character.height <= 560);
});

function psdCharacter() {
    return { name: '茜', url: '/uploads/real.psd', structure: { width: 100, height: 200, nodes: [
        { id: 'L0', parentId: null, path: '体', name: '体', group: false, visible: true, hidden: false, drawable: true },
        { id: 'L1', parentId: null, path: '表情', name: '表情', group: true, visible: true, hidden: false, drawable: false },
        { id: 'L2', parentId: 'L1', path: '表情/*普通', name: '*普通', group: false, visible: true, hidden: false, drawable: true },
        { id: 'L3', parentId: 'L1', path: '表情/*笑顔', name: '*笑顔', group: false, visible: false, hidden: true, drawable: true },
    ] } };
}
function characterScript(neutral) {
    return { title: 'PSD test', tachieConfigs: { 茜: { neutral, mouthOpen: [], mouthClosed: [] } }, scenes: [{ character: '茜', emotion: 'neutral', text: 'こんにちは。', action: 'intro' }] };
}

for (const options of [{}, { provider: 'openai' }, { model: 'claude-sonnet-4-6' }, { provider: 'gemini' }]) {
    test(`PSD IDs are grounded in the inventory and corrected before synthesis: ${JSON.stringify(options)}`, async t => {
        const wrap = value => {
            const text = JSON.stringify(value);
            if (options.provider === 'gemini') return { candidates: [{ content: { role: 'model', parts: [{ text }] } }] };
            if (options.model) return { content: [{ type: 'text', text }] };
            return chatResponse(text);
        };
        const calls = mockApi(t, [wrap(characterScript(['L999'])), wrap(characterScript(['L3']))]);
        const response = await generate({ ...options, tachies: [psdCharacter()] });
        assert.equal(response.status, 200);
        const data = await response.json();
        assert.equal(data.repairAttempts, 1);
        assert.equal(calls.voiceRequests, 1);
        assert.equal(calls.length, 2);
        const request = JSON.stringify(calls[0].body);
        assert.match(request, /initialVisible/);
        assert.match(request, /preservedBase/);
        assert.match(request, /no images are provided/);
        assert.ok(!request.includes('image_url'));
        assert.match(JSON.stringify(calls[1].body), /not an available leaf ID/);
        const clip = data.clips.find(clip => clip.type === 'tachie');
        assert.deepEqual(clip.tachieLayers, ['体', '表情/*笑顔']);
        assert.deepEqual(clip.mouthOpenLayers, []);
        assert.deepEqual(clip.mandatoryLayers, []);
    });
}

test('Unresolved PSD errors stop before TTS and do not import partial characters', async t => {
    const calls = mockApi(t, chatResponse(JSON.stringify(characterScript(['L2', 'L3']))));
    const response = await generate({ tachies: [psdCharacter()] });
    assert.equal(response.status, 422);
    const data = await response.json();
    assert.match(data.issues.join(' '), /conflicting alternatives/);
    assert.equal(data.clips, undefined);
    assert.equal(calls.length, 4);
    assert.equal(calls.voiceRequests, 0);
});

test('Missing PSD structure, invalid manual rules and duplicate character names fail before an API call', async t => {
    const calls = mockApi(t, chatResponse());
    for (const tachies of [
        [{ name: 'Missing', url: '/uploads/no.psd' }],
        [psdCharacter(), psdCharacter()],
        [{ ...psdCharacter(), rules: { mandatory: ['not in this PSD'], exclusive: [], optional: [] } }],
    ]) assert.equal((await generate({ tachies })).status, 400);
    assert.equal(calls.length, 0);
});
