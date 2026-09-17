
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Clip } from '@/types';
import { createSubtitleClips, getSceneLayout, getScriptIssues, MAX_LAYOUT_REPAIRS, splitSubtitlePages } from '@/lib/ai-video';
import { arrangeGeneratedTracks, getTimelineIssues } from '@/lib/generated-timeline';
import { psdStructureSchema, characterContext, getCharacterSetupIssues, getCharacterIssues, resolveCharacterLayers } from '@/lib/psd-structure';

// AIVOICE Server URL
const AIVOICE_SERVER = 'http://localhost:8000';
const VOICEVOX_SERVER = 'http://127.0.0.1:50021';
const CEVIOAI_SERVER = 'http://localhost:8001';

// Simple WAV duration calculator
function getWavDuration(buffer: Buffer): number {
    try {
        const byteRate = buffer.readUInt32LE(28);
        const dataSize = buffer.readUInt32LE(40);
        return dataSize / byteRate;
    } catch (e) {
        return 0;
    }
}

export async function POST(req: NextRequest) {
    try {
        const { prompt, apiKey, provider = 'openai', model, tachies: inputTachies = [] } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        if (!['openai', 'gemini', 'commandcode'].includes(provider)) {
            return NextResponse.json({ error: 'Unsupported AI provider' }, { status: 400 });
        }

        if (provider === 'commandcode' && !z.object({
            apiKey: z.string().optional(),
            model: z.string().optional(),
        }).safeParse({ apiKey, model }).success) {
            return NextResponse.json({ error: 'API key and model must be strings' }, { status: 400 });
        }

        let scriptData;
        let repairAttempts = 0;

        const characterSchema = z.object({
            name: z.string().trim().min(1), url: z.string().min(1),
            role: z.string().optional(), facing: z.string().optional(),
            structure: psdStructureSchema,
            rules: z.object({ mandatory: z.array(z.string()), exclusive: z.array(z.object({ name: z.string(), path: z.string() })), optional: z.array(z.string()).default([]) }).optional(),
        }).passthrough();
        const parsedCharacters = z.array(characterSchema).safeParse(inputTachies);
        if (!parsedCharacters.success) return NextResponse.json({ error: 'PSDの構造を解析できません。キャラクターの「構造を再解析」を実行してください。', issues: parsedCharacters.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`) }, { status: 400 });
        if (new Set(parsedCharacters.data.map(character => character.name)).size !== parsedCharacters.data.length) return NextResponse.json({ error: 'キャラクター名が重複しています。別々の名前を付けてください。' }, { status: 400 });
        const setupIssues = parsedCharacters.data.flatMap(getCharacterSetupIssues);
        if (setupIssues.length) return NextResponse.json({ error: 'PSDの設定に矛盾があります。', issues: setupIssues }, { status: 400 });
        // Keep synthesis settings while validating the PSD-specific contract.
        const tachies = parsedCharacters.data.map((character, index) => ({ ...inputTachies[index], ...character }));

        const systemInstruction = `You are a versatile video script generator.
            Your goal is to faithfully convert the User Request into a high-quality video script while strictly following the requested tone, style, and content.
            DO NOT force a "tech tutorial" or "engineer" style unless the user explicitly requests it.
            Respect the vocabulary, character roles, and atmosphere provided in the user's prompt.

            The output must strictly follow this JSON schema:
            {
              "title": "Video Title",
              "tachieConfigs": {
                "CharacterName": {
                   "neutral": ["L12", "L24", "L35"],
                   "happy": ["L13", "L25", "L35"],
                   "mouthOpen": [],
                   "mouthClosed": []
                }
              },
              "scenes": [
                {
                  "text": "The dialogue line. Match the user's intended tone exactly.",
                  "character": "CharacterName",
                  "emotion": "neutral" | "happy" | "sad" | "surprised" | "serious",
                  "action": "intro" | "explain" | "code" | "summary" | "outro",
                  "codeBlocks": [
                    { "code": "code snippet", "fileName": "App.tsx", "language": "tsx" }
                  ],
                  "overlays": [ // EXTRA CLIPS for creativity
                    {
                      "type": "shape" | "icon" | "text" | "image",
                      "content": "rect" | "circle" | "lucide:star" | "Extra text" | "URL",
                      "layer": "background" | "foreground",
                      "x": number, "y": number, "width": number, "height": number,
                      "animation": { "type": string, "duration": number },
                      "keyframes": { // Supported properties: x, y, z, rotate, scale, skewX, skewY, perspective, opacity, blur, brightness, contrast, saturate, hueRotate, grayscale, invert
                         "x": [{ "frame": number, "value": number, "easing": "linear" | "ease-in" | "ease-out" | "ease-in-out" }],
                         "z": [{ "frame": number, "value": number }],
                         "perspective": [{ "frame": number, "value": number }],
                         "blur": [{ "frame": number, "value": number }],
                         "brightness": [{ "frame": number, "value": number }],
                         "saturate": [{ "frame": number, "value": number }],
                         "opacity": [{ "frame": number, "value": number }]
                      },
                      "effects": [{ "type": string, "color": "#hex", "intensity": 1 }],
                      "style": { "backgroundColor": "#hex", "color": "#hex", "borderRadius": "50%", "opacity": 0.8 }
                    }
                  ],
                  "keyframes": { // Movement/Effects for the main character
                     "x": [{ "frame": number, "value": number }],
                     "y": [{ "frame": number, "value": number }],
                     "z": [{ "frame": number, "value": number }],
                     "perspective": [{ "frame": number, "value": number }],
                     "blur": [{ "frame": number, "value": number }],
                     "opacity": [{ "frame": number, "value": number }]
                  },
                  "visualDescription": "Brief description",
                  "position": "left" | "right" | "center",
                  "mirror": boolean, 
                  "effects": [
                    { "type": "glow" | "outline" | "pulse" | "float", "color": "#ff0000" }
                  ]
                }
              ]
            }
            ${characterContext(parsedCharacters.data)}
            Total scenes: Generate an appropriate number of scenes (usually 5 to 15) to cover the prompt content naturally. DO NOT pad with unnecessary filler.
            Language: Use the same language as the User Request (default to Japanese).
            Tone: STRICTLY FOLLOW the tone of the User Request.

             ANIMATIONS: fade, pop, slideUp, slideDown, slideLeft, slideRight, spin, shake, bounce.
             EFFECTS: glow, outline, shadow, drop-shadow, blur, blur-complex, sepia, grayscale, saturate, invert, pulse, float, hue-rotate, brightness, contrast.
             KEYFRAMEABLE: x, y, z, rotate, scale, skewX, skewY, perspective, opacity, blur, brightness, contrast, saturate, hueRotate, grayscale, invert.

             VISUAL STYLE: Prioritize legibility. Use restrained colors, short headings and generous spacing.
             Prefer no effect or a simple fade. Do not apply glow, outline, blur or 3D distortion to text or code.

            LAYOUT REQUIREMENTS:
            - The canvas is 1280x720. All overlays must fit within x=0..1280 and y=0..560, including keyframe motion.
            - The bottom area y=560..720 is reserved for readable subtitles. Never add dialogue as a text overlay.
            - Text and icons must not intersect text, code, preview or character boxes. Shapes behind labels are allowed.
            - Headings belong in y=24..96, above the content panels. All panels occupy y=120..540.
            - ${tachies.length > 0 ? 'With a left character: character x=40..400; content panels x=440..1240. For a right character these are mirrored: content x=40..840; character x=880..1240.' : 'Content panels occupy x=40..1240.'}
            - Code and preview share the content area in separate columns (60% code, 40% preview, 24px gap). Use at most two short code blocks. Keep code lines short enough to be readable at 20px.
            - Characters stay in their assigned panels; only opacity keyframes are allowed on characters.
            - For overlays use x/y/opacity keyframes; avoid scale, rotation and perspective so the occupied area remains predictable.
            - Use short text labels with explicit font sizes. Keep dialogue in scene.text; the app paginates subtitles.
            - Tracks and scene timing are assigned by the application. Do not attempt to assign track IDs.

            IMPORTANT: Return ONLY valid JSON.`;

        try {
            let previousResponse = '';
            let issues: string[] = [];
            for (let attempt = 0; attempt <= MAX_LAYOUT_REPAIRS; attempt++) {
                const messages: { role: 'user' | 'assistant'; content: string }[] = [{ role: 'user', content: prompt }];
                if (attempt > 0) {
                    messages.push(
                        { role: 'assistant', content: previousResponse },
                        { role: 'user', content: `The generated video failed validation. Fix the following problems and return the complete corrected JSON. Preserve the requested content and dialogue; change only what is necessary.\n${issues.slice(0, 20).join('\n')}` },
                    );
                }
                let content;
                if (provider === 'gemini') {
                    const geminiKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
                    if (!geminiKey) return NextResponse.json({ error: 'No Gemini API Key' }, { status: 400 });
                    const genAI = new GoogleGenerativeAI(geminiKey);
                    const gemini = genAI.getGenerativeModel({
                        model: 'gemini-flash-latest',
                        systemInstruction,
                        generationConfig: { responseMimeType: 'application/json' },
                    });
                    const result = await gemini.generateContent({
                        contents: messages.map(message => ({
                            role: message.role === 'assistant' ? 'model' : 'user',
                            parts: [{ text: message.content }],
                        })),
                    });
                    content = result.response.text();
                } else {
                    const isCommandCode = provider === 'commandcode';
                    const providerKey = isCommandCode
                        ? apiKey?.trim() || process.env.CMD_API_KEY?.trim()
                        : apiKey || process.env.OPENAI_API_KEY;
                    if (!providerKey) {
                        return NextResponse.json({
                            error: isCommandCode ? 'Enter a Command Code API key or set CMD_API_KEY on the server.' : 'No OpenAI API Key',
                        }, { status: 400 });
                    }
                    const client = new OpenAI({
                        apiKey: providerKey,
                        timeout: 120_000,
                        maxRetries: 0,
                        ...(isCommandCode ? {
                            baseURL: 'https://api.commandcode.ai/provider/v1',
                            organization: null,
                            project: null,
                        } : {}),
                    });
                    const modelId = isCommandCode ? model?.trim() || 'deepseek/deepseek-v4-flash' : 'gpt-4o';
                    if (isCommandCode && modelId.startsWith('claude-')) {
                        const message = await client.post<{
                            content: { type: string; text?: string }[];
                        }>('/messages', {
                            headers: { 'anthropic-version': '2023-06-01' },
                            body: {
                                model: modelId, max_tokens: 16_384,
                                system: systemInstruction, messages,
                            },
                        });
                        content = message.content?.filter(block => block.type === 'text').map(block => block.text || '').join('');
                    } else {
                        const completion = await client.chat.completions.create({
                            model: modelId,
                            messages: [{ role: 'system', content: systemInstruction }, ...messages],
                            ...(isCommandCode ? {} : { response_format: { type: 'json_object' as const } }),
                        });
                        content = completion.choices?.[0]?.message?.content;
                    }
                }
                if (!content?.trim()) throw new Error(`No content from ${provider}`);
                previousResponse = content;
                try {
                    scriptData = JSON.parse(content.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim());
                    issues = [...getScriptIssues(scriptData, tachies.length > 0), ...getCharacterIssues(scriptData, parsedCharacters.data)];
                } catch {
                    issues = ['The response is not valid JSON. Return only the complete video script JSON.'];
                }
                if (issues.length === 0) {
                    repairAttempts = attempt;
                    break;
                }
                if (attempt === MAX_LAYOUT_REPAIRS) {
                    return NextResponse.json({
                        error: `AI could not correct the video layout or PSD selections after ${MAX_LAYOUT_REPAIRS} repairs. No clips were imported.`,
                        issues: issues.slice(0, 20),
                    }, { status: 422 });
                }
            }
        } catch (error) {
            return NextResponse.json({
                error: error instanceof Error ? error.message : 'AI generation failed',
            }, { status: error instanceof OpenAI.APIError ? error.status || 502 : 502 });
        }

        // Process Scenes to Generate Audio & Clips
        const clips: Clip[] = [];
        let currentFrame = 90;



        // Title Clip
        clips.push({
            id: 'title-' + Date.now(),
            type: 'text',
            trackId: 2,
            startFrame: 0,
            durationInFrames: 90,
            content: scriptData.title,
            title: 'Main Title',
            x: 340, y: 100, width: 600, height: 100,
            style: {
                color: '#ffffff', fontSize: '60px', fontWeight: 'bold',
                textAlign: 'center', fontFamily: 'Inter', textShadow: '0 4px 10px rgba(0,0,0,0.5)'
            },
            animation: { type: 'pop', duration: 20 }
        });



        for (let i = 0; i < scriptData.scenes.length; i++) {
            const scene = scriptData.scenes[i];

            // 0. Find Target Character
            const sceneCharacterName = scene.character;
            const targetCharacter = tachies.find((t: any) => t.name === sceneCharacterName);

            // 1. Generate Audio
            let audioUrl = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';
            let duration = (scene.text.length * 0.2) + 1.0;

            try {
                const charVoice = targetCharacter?.voice;

                if (charVoice?.provider === 'aivoice') {
                    const ttsRes = await fetch(`${AIVOICE_SERVER}/synthesize`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: scene.text, preset: charVoice.aivoicePreset }),
                        signal: AbortSignal.timeout(5000)
                    }).catch(() => null);

                    if (ttsRes && ttsRes.ok) {
                        const ttsData = await ttsRes.json();
                        audioUrl = ttsData.url;
                        duration = Number(ttsData.duration) || duration;
                    }
                } else if (charVoice?.provider === 'cevioai') {
                    const ttsRes = await fetch(`${CEVIOAI_SERVER}/synthesize`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text: scene.text, cast: charVoice.cevioaiSpeaker }),
                        signal: AbortSignal.timeout(10000)
                    }).catch(() => null);

                    if (ttsRes && ttsRes.ok) {
                        const ttsData = await ttsRes.json();
                        audioUrl = ttsData.url;
                        duration = Number(ttsData.duration) || duration;
                    }
                } else {
                    // VOICEVOX (Default)
                    const speakerId = charVoice?.voicevoxStyle || 0;
                    const queryRes = await fetch(`${VOICEVOX_SERVER}/audio_query?text=${encodeURIComponent(scene.text)}&speaker=${speakerId}`, {
                        method: 'POST',
                        signal: AbortSignal.timeout(3000)
                    }).catch(() => null);

                    if (queryRes && queryRes.ok) {
                        const queryData = await queryRes.json();
                        const synthRes = await fetch(`${VOICEVOX_SERVER}/synthesis?speaker=${speakerId}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(queryData),
                            signal: AbortSignal.timeout(10000)
                        }).catch(() => null);

                        if (synthRes && synthRes.ok) {
                            const audioBuffer = Buffer.from(await synthRes.arrayBuffer());
                            const filename = `synth-ai-${Date.now()}-${i}.wav`;
                            const fs = require('fs');
                            const path = require('path');
                            const uploadDir = path.join(process.cwd(), 'public', 'uploads');
                            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
                            fs.writeFileSync(path.join(uploadDir, filename), audioBuffer);
                            audioUrl = `/uploads/${filename}`;
                            duration = getWavDuration(audioBuffer) || duration;
                        }
                    }
                }
            } catch (err) {
                console.warn("TTS Failed, using fallback:", err);
            }

            const frames = Math.max(splitSubtitlePages(scene.text).length, Math.ceil(duration * 30));
            const padding = 15;
            const totalSceneFrames = frames + padding;

            // Audio Clip
            clips.push({
                id: `audio-${i}`,
                type: 'audio',
                trackId: 8,
                startFrame: currentFrame,
                durationInFrames: frames,
                content: audioUrl,
                title: `Voice ${i + 1}`,
                animation: { type: 'none', duration: 0 }
            });

            clips.push(...createSubtitleClips(scene.text, currentFrame, frames, i));

            // Character Clip Selection
            const hasTachie = tachies.length > 0;
            const layout = getSceneLayout(scene, hasTachie);

            if (hasTachie) {
                const activeTachieUrl = targetCharacter?.url || tachies[0]?.url;

                const emotion = scene.emotion || 'neutral';
                const tachieLayout = layout.character!;
                const layerSelection = resolveCharacterLayers(targetCharacter, scriptData.tachieConfigs[sceneCharacterName], emotion);

                clips.push({
                    id: `char-${i}`,
                    type: 'tachie',
                    trackId: 4,
                    startFrame: currentFrame,
                    durationInFrames: totalSceneFrames,
                    content: activeTachieUrl,
                    title: `${sceneCharacterName || 'Character'} (${emotion})`,
                    x: tachieLayout.x,
                    y: tachieLayout.y,
                    width: tachieLayout.width,
                    height: tachieLayout.height,
                    ...layerSelection,
                    audioUrl: audioUrl,
                    // The validated selection already contains the preserved base.
                    mandatoryLayers: [],
                    facing: targetCharacter?.facing || 'right',
                    mirror: scene.mirror || false,
                    keyframes: scene.keyframes || {},
                    animation: (i === 0 || sceneCharacterName !== scriptData.scenes[i - 1]?.character) ? { type: 'fade', duration: 20 } : { type: 'none', duration: 0 }
                });
            }

            const codeBlocks = scene.codeBlocks || (scene.codeContent ? [{ code: scene.codeContent, language: 'tsx', fileName: 'Code' }] : []);
            const hasCode = codeBlocks.length > 0;
            const hasPreview = !!scene.previewContent;

            // 4. Handle Overlays (AI-driven extra clips)
            if (scene.overlays && Array.isArray(scene.overlays)) {
                scene.overlays.forEach((ov: any, idx: number) => {
                    const trackId = ov.layer === 'foreground' ? 3 : 6;
                    clips.push({
                        id: `ov-${i}-${idx}`,
                        type: ov.type || 'shape',
                        trackId: trackId,
                        startFrame: currentFrame,
                        durationInFrames: totalSceneFrames,
                        content: ov.content,
                        x: ov.x ?? 100,
                        y: ov.y ?? 100,
                        width: ov.width ?? 200,
                        height: ov.height ?? 200,
                        style: ov.type === 'text' ? { fontSize: '32px', fontWeight: 600, lineHeight: 1.3, ...ov.style, textShadow: 'none' } : ov.style || {},
                        animation: ov.animation || { type: 'fade', duration: 15 },
                        effects: ov.effects || [],
                        keyframes: ov.keyframes || {}
                    });
                });
            }
            const previewDelay = Math.max(0, Math.min(1, scene.previewDelay || 0));

            if (hasCode) {
                codeBlocks.forEach((block: any, idx: number) => {
                    // Generate line-by-line typing effect
                    const codeStr = block.code || '';
                    const lines = codeStr.split('\n');
                    const codeSteps = [];
                    let currentCode = '';

                    // Animate over 40% of the duration or max 60 frames (2s)
                    const animDuration = Math.min(totalSceneFrames * 0.4, 60);
                    const framesPerLine = Math.max(2, Math.floor(animDuration / Math.max(1, lines.length)));

                    for (let j = 0; j < lines.length; j++) {
                        currentCode += (j > 0 ? '\n' : '') + lines[j];
                        codeSteps.push({
                            code: currentCode,
                            frameOffset: j * framesPerLine
                        });
                    }

                    clips.push({
                        id: `code-${i}-${idx}`,
                        type: 'code',
                        trackId: 5,
                        startFrame: currentFrame,
                        durationInFrames: totalSceneFrames,
                        content: codeStr,
                        title: block.fileName || `Code ${idx + 1}`,
                        ...layout.code[idx],
                        language: block.language || 'tsx',
                        steps: codeSteps,
                        animation: { type: 'fade', duration: 10 }
                    });
                });
            }

            // Preview Clip
            if (hasPreview) {
                const delayFrames = Math.floor(totalSceneFrames * previewDelay);
                const previewStart = currentFrame + delayFrames;
                const previewDuration = Math.max(1, totalSceneFrames - delayFrames); // Ensure duration is at least 1 frame

                clips.push({
                    id: `preview-${i}`,
                    type: 'browser',
                    trackId: 5,
                    startFrame: previewStart,
                    durationInFrames: previewDuration,
                    content: scene.previewContent!,
                    title: 'Preview',
                    ...layout.preview,
                    animation: { type: 'fade', duration: 15 }
                });
            } else if (scene.action === 'explain' || scene.action === 'intro') {
                // Maybe show a simple text point or image?
            }

            currentFrame += totalSceneFrames;
        }

        // Update BG duration - Generated at the end to cover full duration and placed on bottom track
        const bgClip: Clip = {
            id: 'bg-' + Date.now(),
            type: 'shape',
            trackId: 7,
            startFrame: 0,
            durationInFrames: currentFrame + 60,
            content: 'rect',
            title: 'Background',
            x: 0, y: 0, width: 1280, height: 720,
            style: { background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)' },
            animation: { type: 'none', duration: 0 }
        };
        clips.unshift(bgClip);

        const arrangedClips = arrangeGeneratedTracks(clips);
        const timelineIssues = getTimelineIssues(arrangedClips);
        if (timelineIssues.length > 0) {
            return NextResponse.json({ error: 'Generated timeline is invalid.', issues: timelineIssues }, { status: 422 });
        }
        return NextResponse.json({ success: true, clips: arrangedClips, repairAttempts });

    } catch (error: any) {
        console.error("AI Generation Error:", error);
        return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
    }
}
