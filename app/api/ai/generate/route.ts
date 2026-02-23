
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';

// Define the response schema we expect from LLM
const ScriptSchema = z.object({
    title: z.string(),
    scenes: z.array(z.object({
        text: z.string(),
        duration: z.number().optional(), // Estimated reading duration
        action: z.enum(['intro', 'explain', 'code', 'summary', 'outro']),
        codeContent: z.string().optional(),
        visualDescription: z.string().optional(),
    }))
});

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
        const { prompt, apiKey, provider = 'openai', tachies = [] } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        let scriptData;

        let characterContext = "";
        if (tachies && tachies.length > 0) {
            characterContext = `
            AVAILABLE CHARACTERS:
            ${tachies.map((t: any) => `
            - Character Name: "${t.name}"
              Role/Personality: "${t.role || 'General assistant'}"
              Asset Facing: "${t.facing || 'right'}" (The character is facing ${t.facing || 'right'} in the PSD)
              Layers: ${JSON.stringify(t.layers)}
              ${t.rules ? `
              LAYER RULES:
              - Mandatory Groups (Character's base appearance - DO NOT INCLUDE these in your emotion layer lists, they are added automatically): ${JSON.stringify(t.rules.mandatory)}
              - Exclusive Groups (Pick EXACTLY ONE leaf-layer path from each of these folders for every emotion/pose you define): ${JSON.stringify(t.rules.exclusive.map((e: any) => e.path))}
              - Optional Groups (Extra details like sweat, anger marks. You MAY include zero or more leaf-layer paths from these folders to enhance the emotion): ${JSON.stringify(t.rules.optional || [])}
              ` : ''}
            `).join('\n')}

            INSTRUCTIONS FOR TACHIE (CHARACTER):
            1. You MUST generate a "tachieConfigs" object in the JSON root.
            2. "tachieConfigs" is a map: { [characterName: string]: { [emotion: string]: string[], "mouthOpen": string[], "mouthClosed": string[] } }.
            3. Define layer sets for emotions like "neutral", "happy", "sad", "surprised", "serious". You MAY also define custom emotions (e.g., "thinking", "pointing") as needed.
            4. Define "mouthOpen" (e.g., layers with "口", "あ", "開") and "mouthClosed" (e.g., layers with "口", "ん", "閉").
            5. The "neutral"/"happy"/etc. sets should generally include a default "closed" mouth layer.
            6. Use total layer paths from the provided list for each character.
            7. Identify base layers (Body, Hair, Clothes) and expression layers.
            8. Each SCENE must specify which "character" is speaking.
            9. Tailor the dialogue and emotions based on the Role/Personality provided for each character.
            10. IMPORTANT: If LAYER RULES are provided, they are ABSOLUTE. For Exclusive Groups, you MUST choose exactly one leaf-layer path that starts with that folder path for EVERY set you define. 
            11. HIERARCHY RULE: If a parent folder is an Exclusive Group, pick ONLY ONE leaf from its entire sub-directory. Ignore any further selection rules within that sub-directory; the parent group's selection covers the entire tree below it.
            `;
        }

        const systemInstruction = `You are a versatile video script generator.
            Your goal is to faithfully convert the User Request into a high-quality video script while strictly following the requested tone, style, and content.
            DO NOT force a "tech tutorial" or "engineer" style unless the user explicitly requests it.
            Respect the vocabulary, character roles, and atmosphere provided in the user's prompt.

            The output must strictly follow this JSON schema:
            {
              "title": "Video Title",
              "tachieConfigs": {
                "CharacterName": {
                   "neutral": ["Layer/Body", "Layer/Eyes/Normal", "Layer/Mouth/Closed"],
                   "happy": ["Layer/Body", "Layer/Eyes/Happy", "Layer/Mouth/Closed"],
                   "mouthOpen": ["Layer/Mouth/Open"],
                   "mouthClosed": ["Layer/Mouth/Closed"]
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
            ${characterContext}
            Total scenes: Generate an appropriate number of scenes (usually 5 to 15) to cover the prompt content naturally. DO NOT pad with unnecessary filler.
            Language: Use the same language as the User Request (default to Japanese).
            Tone: STRICTLY FOLLOW the tone of the User Request.

             ANIMATIONS: fade, pop, slideUp, slideDown, slideLeft, slideRight, spin, shake, bounce.
             EFFECTS: glow, outline, shadow, drop-shadow, blur, blur-complex, sepia, grayscale, saturate, invert, pulse, float, hue-rotate, brightness, contrast.
             KEYFRAMEABLE: x, y, z, rotate, scale, skewX, skewY, perspective, opacity, blur, brightness, contrast, saturate, hueRotate, grayscale, invert.

             CREATIVITY GUIDE & CINEMATIC HACKS:
             1. 3D & THEATRICAL: Use "z", "perspective", and "skew". 
                - Zoom in effect: "z": [{frame:0, value:-1000}, {frame:40, value:0, easing:"ease-out"}].
                - 3D Slide: Combine x movement with rotate and perspective.
             2. MOOD SHIFTS: Keyframe "brightness", "contrast", and "grayscale".
                - Dynamic highlighting: Pulse "brightness" from 1 to 1.5.
             3. KEYFRAMES: You MUST use keyframes for any motion that isn't a simple entrance.
             4. SHAPES (Circle/Box): Use "type": "shape" with "content": "circle" or "rect". 
             5. ICONS: Use "type": "icon" with "content": "lucide:NAME".
             6. OVERLAYS: Background decorations (low z, low opacity) or foreground popups.

            IMPORTANT: Return ONLY valid JSON.`;

        try {
            if (provider === 'gemini') {
                const { GoogleGenerativeAI } = require("@google/generative-ai");
                const geminiKey = apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

                if (!geminiKey) throw new Error("No Gemini API Key");

                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-flash-latest", generationConfig: { responseMimeType: "application/json" } });

                const result = await model.generateContent(`${systemInstruction}\n\nUser Request: ${prompt}`);
                const response = await result.response;
                const text = response.text()
                    .replace(/^```json\s*/, '')
                    .replace(/```$/, '')
                    .trim();

                scriptData = JSON.parse(text);

            } else {
                // OpenAI Fallback
                const openaiApiKey = apiKey || process.env.OPENAI_API_KEY;
                if (!openaiApiKey) throw new Error("No OpenAI API Key");

                const client = new OpenAI({ apiKey: openaiApiKey });
                const completion = await client.chat.completions.create({
                    model: "gpt-4o",
                    messages: [
                        { role: "system", content: systemInstruction },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                });

                const content = completion.choices[0].message.content;
                if (!content) throw new Error("No content from OpenAI");

                const cleanContent = content
                    .replace(/^```json\s*/, '')
                    .replace(/```$/, '')
                    .trim();

                scriptData = JSON.parse(cleanContent);
            }

        } catch (e) {
            console.warn(`LLM (${provider}) error:`, e);
            console.warn("Using mock fallback due to error.");
            // Mock Fallback
            scriptData = {
                title: `Tutorial: ${prompt}`,
                scenes: [
                    {
                        text: "こんにちは！エフェクト機能のテストだよ。",
                        character: tachies[0]?.name || "Guest",
                        emotion: "happy",
                        action: "intro",
                        effects: [{ type: "glow", color: "#ffff00", blur: 20 }]
                    },
                    { text: "キャラクターを光らせたりできるんだ。", character: tachies[0]?.name || "Guest", emotion: "neutral", action: "explain" },
                    {
                        text: "すごいね！",
                        character: tachies[1]?.name || tachies[0]?.name || "Guest",
                        emotion: "surprised",
                        action: "explain",
                        effects: [{ type: "outline", color: "#ff00ff", width: 3 }]
                    },
                    { text: "これからもっと便利になるよ。", character: tachies[0]?.name || "Guest", emotion: "happy", action: "summary" }
                ]
            };
        }

        // Process Scenes to Generate Audio & Clips
        const clips = [];
        let currentFrame = 0;



        // Title Clip
        clips.push({
            id: 'title-' + Date.now(),
            type: 'text',
            trackId: 1,
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
            const targetCharacter = tachies.find((t: any) => t.name === sceneCharacterName) || tachies[0];

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

            const frames = Math.ceil(duration * 30);
            const padding = 15;
            const totalSceneFrames = frames + padding;

            // Audio Clip
            clips.push({
                id: `audio-${i}`,
                type: 'audio',
                trackId: 3,
                startFrame: currentFrame,
                durationInFrames: frames,
                content: audioUrl,
                title: `Voice ${i + 1}`,
                animation: { type: 'none', duration: 0 }
            });

            // Subtitle Clip
            clips.push({
                id: `sub-${i}`,
                type: 'text',
                trackId: 1,
                startFrame: currentFrame,
                durationInFrames: frames,
                content: scene.text,
                title: 'Subtitle',
                x: 140, y: 580, width: 1000, height: 100,
                style: {
                    color: '#ffffff', fontSize: '28px', fontFamily: 'Noto Sans JP',
                    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: '12px', padding: '16px',
                    textAlign: 'center', backdropFilter: 'blur(4px)'
                },
                effects: scene.effects || [],
                animation: { type: 'fade', duration: 5 }
            });

            // Character Clip Selection
            const hasTachie = tachies.length > 0;

            if (hasTachie) {
                const activeTachieUrl = targetCharacter?.url || tachies[0]?.url;

                let tachieLayers: string[] = [];
                const emotion = scene.emotion || 'neutral';

                // Determine Layout & Content
                const codeBlocks = scene.codeBlocks || (scene.codeContent ? [{ code: scene.codeContent, language: 'tsx', fileName: 'Code' }] : []);
                const hasCode = codeBlocks.length > 0;
                const hasPreview = !!scene.previewContent;

                const previewLayout = scene.previewLayout || 'split';
                const isOverlay = previewLayout === 'overlay';
                const previewDelay = Math.max(0, Math.min(1, scene.previewDelay || 0)); // Clamp 0-1

                let tachieLayout = { x: 50, y: 150, width: 600, height: 600 };

                // Apply position override if provided by LLM
                if (scene.position === 'right') {
                    tachieLayout = { x: 680, y: 150, width: 600, height: 600 };
                } else if (scene.position === 'center') {
                    tachieLayout = { x: 340, y: 150, width: 600, height: 600 };
                } else if (hasCode && hasPreview && !isOverlay) {
                    // Tri-layout: Tachie (Left Edge) | Code (Center) | Preview (Right)
                    tachieLayout = { x: -100, y: 220, width: 540, height: 540 };
                } else if (hasCode) {
                    // Split-layout: Tachie (Left) | Code (Right)
                    tachieLayout = { x: 0, y: 150, width: 600, height: 600 };
                }

                let mouthOpenLayers: string[] = [];
                let mouthClosedLayers: string[] = [];

                // Layer Resolution
                if (scriptData.tachieConfigs && scriptData.tachieConfigs[sceneCharacterName]) {
                    const config = scriptData.tachieConfigs[sceneCharacterName];
                    tachieLayers = config[emotion] || config['neutral'] || [];
                    mouthOpenLayers = config.mouthOpen || [];
                    mouthClosedLayers = config.mouthClosed || [];
                } else if (scriptData.tachieConfig && !sceneCharacterName) {
                    // Backward compatibility / Single character mode
                    tachieLayers = scriptData.tachieConfig[emotion] || scriptData.tachieConfig['neutral'] || [];
                    mouthOpenLayers = scriptData.tachieConfig.mouthOpen || [];
                    mouthClosedLayers = scriptData.tachieConfig.mouthClosed || [];
                } else {
                    // Fallback: Hardcoded Akane Logic
                    const AKANE_BASE_LAYERS = [
                        '琴葉姉妹', '琴葉姉妹/!後ろ髪', '琴葉姉妹/!後ろ髪/*あかねちゃん', '琴葉姉妹/!後ろ髪/!もみあげ',
                        '琴葉姉妹/胴体', '琴葉姉妹/胴体/*あかねちゃん', '琴葉姉妹/胴体/*あかねちゃん/腕/!右腕/*下',
                        '琴葉姉妹/胴体/*あかねちゃん/腕/!左腕/*下', '琴葉姉妹/胴体/*あかねちゃん/!胴体/!足/*立っている',
                        '琴葉姉妹/胴体/*あかねちゃん/!胴体/*下にしている', '琴葉姉妹/胴体/*あかねちゃん/!装飾',
                        '琴葉姉妹/!素体', '琴葉姉妹/ほっぺた/*上', '琴葉姉妹/手前に出てる腕', '琴葉姉妹/!前髪',
                        '琴葉姉妹/!前髪/*あかねちゃん', '琴葉姉妹/!前髪/*あかねちゃん/!髪飾り右/*あかねちゃん',
                        '琴葉姉妹/!前髪/*あかねちゃん/*標準', '琴葉姉妹/!表情'
                    ];

                    const TACHIE_EMOTIONS: Record<string, string[]> = {
                        neutral: ['琴葉姉妹/!表情/目/*縦目', '琴葉姉妹/!表情/口/*ｖ', '琴葉姉妹/!表情/眉毛/*普通/*1'],
                        happy: ['琴葉姉妹/!表情/目/*ニコ', '琴葉姉妹/!表情/口/*ω', '琴葉姉妹/!表情/眉毛/*普通/*1'],
                        sad: ['琴葉姉妹/!表情/目/*ゼロ目', '琴葉姉妹/!表情/口/*ム', '琴葉姉妹/!表情/眉毛/*普通/*3'],
                        surprised: ['琴葉姉妹/!表情/目/*縦目', '琴葉姉妹/!表情/口/*□', '琴葉姉妹/!表情/眉毛/*普通/*2'],
                        serious: ['琴葉姉妹/!表情/目/*ジト目→', '琴葉姉妹/!表情/口/*-', '琴葉姉妹/!表情/眉毛/*普通/*2']
                    };

                    const emotionLayers = TACHIE_EMOTIONS[emotion] || TACHIE_EMOTIONS['neutral'];
                    tachieLayers = [...AKANE_BASE_LAYERS, ...emotionLayers];

                    // Fallback Mouth Sync
                    mouthOpenLayers = ['琴葉姉妹/!表情/口/*あ'];
                    mouthClosedLayers = ['琴葉姉妹/!表情/口/*ん', '琴葉姉妹/!表情/口/*ｖ'];
                }

                clips.push({
                    id: `char-${i}`,
                    type: 'tachie',
                    trackId: 2,
                    startFrame: currentFrame,
                    durationInFrames: totalSceneFrames,
                    content: activeTachieUrl,
                    title: `${sceneCharacterName || 'Character'} (${emotion})`,
                    x: tachieLayout.x,
                    y: tachieLayout.y,
                    width: tachieLayout.width,
                    height: tachieLayout.height,
                    tachieLayers: tachieLayers,
                    effects: scene.effects || [],
                    audioUrl: audioUrl,
                    mouthOpenLayers,
                    mouthClosedLayers,
                    mandatoryLayers: scene.mandatoryLayers || targetCharacter?.rules?.mandatory || [],
                    facing: targetCharacter?.facing || 'right',
                    mirror: scene.mirror || false,
                    keyframes: scene.keyframes || {},
                    animation: (i === 0 || sceneCharacterName !== scriptData.scenes[i - 1]?.character) ? { type: 'slide', duration: 20 } : { type: 'none', duration: 0 }
                });
            }

            const codeBlocks = scene.codeBlocks || (scene.codeContent ? [{ code: scene.codeContent, language: 'tsx', fileName: 'Code' }] : []);
            const hasCode = codeBlocks.length > 0;
            const hasPreview = !!scene.previewContent;
            const previewLayout = scene.previewLayout || 'split';
            const isOverlay = previewLayout === 'overlay';

            // 4. Handle Overlays (AI-driven extra clips)
            if (scene.overlays && Array.isArray(scene.overlays)) {
                scene.overlays.forEach((ov: any, idx: number) => {
                    const trackId = ov.layer === 'foreground' ? 1 : 4; // 1 is foreground (above all), 4 is background
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
                        style: ov.style || {},
                        animation: ov.animation || { type: 'fade', duration: 15 },
                        effects: ov.effects || [],
                        keyframes: ov.keyframes || {}
                    });
                });
            }
            const previewDelay = Math.max(0, Math.min(1, scene.previewDelay || 0));

            if (hasCode) {
                const availableHeight = 650;
                const startY = 50;
                const blockHeight = Math.floor(availableHeight / codeBlocks.length);

                let codeX = 600;
                let codeWidth = 600;

                if (!hasTachie) {
                    codeX = (hasPreview && !isOverlay) ? 100 : 140;
                    codeWidth = (hasPreview && !isOverlay) ? 650 : 1000;
                } else {
                    codeX = (hasPreview && !isOverlay) ? 340 : 600;
                    codeWidth = (hasPreview && !isOverlay) ? 500 : 600;
                }

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
                        trackId: 4 + idx,
                        startFrame: currentFrame,
                        durationInFrames: totalSceneFrames,
                        content: codeStr,
                        title: block.fileName || `Code ${idx + 1}`,
                        x: codeX,
                        y: startY + (idx * blockHeight),
                        width: codeWidth,
                        height: blockHeight - 20, // Margin
                        language: block.language || 'tsx',
                        steps: codeSteps,
                        effects: scene.effects || [],
                        transitionDuration: 5, // Snappier line transition
                        animation: { type: 'pop', duration: 10 }
                    });
                });
            }

            // Preview Clip
            if (hasPreview) {
                const delayFrames = Math.floor(totalSceneFrames * previewDelay);
                const previewStart = currentFrame + delayFrames;
                const previewDuration = Math.max(1, totalSceneFrames - delayFrames); // Ensure duration is at least 1 frame

                let previewX = 870;
                let previewY = 50;
                let previewWidth = 400;
                let previewHeight = 400;

                if (!hasTachie && !isOverlay) {
                    previewX = 800; // Shift left a bit if code is wider
                }

                if (isOverlay) {
                    previewX = hasTachie ? 600 : 340; // Center (cover code)
                    previewY = 150; // Align with code block top
                    previewWidth = hasTachie ? 600 : 600; // Match code width
                    previewHeight = 500; // Slightly larger to cover more of code area
                }

                clips.push({
                    id: `preview-${i}`,
                    type: 'browser',
                    trackId: 8, // Dedicated track for preview
                    startFrame: previewStart,
                    durationInFrames: previewDuration,
                    content: scene.previewContent!,
                    title: 'Preview',
                    x: previewX,
                    y: previewY,
                    width: previewWidth,
                    height: previewHeight,
                    animation: { type: 'pop', duration: 15 } // Pop in sync with code
                });
            } else if (scene.action === 'explain' || scene.action === 'intro') {
                // Maybe show a simple text point or image?
            }

            currentFrame += totalSceneFrames;
        }

        // Update BG duration - Generated at the end to cover full duration and placed on bottom track
        const bgClip = {
            id: 'bg-' + Date.now(),
            type: 'shape',
            trackId: 10, // Separated Track for Background
            startFrame: 0,
            durationInFrames: currentFrame + 60,
            content: 'rect',
            title: 'Background',
            x: 0, y: 0, width: 1280, height: 720,
            style: { background: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)' },
            animation: { type: 'none', duration: 0 }
        };
        clips.unshift(bgClip);

        return NextResponse.json({ success: true, clips });

    } catch (error: any) {
        console.error("AI Generation Error:", error);
        return NextResponse.json({ error: error.message || 'Generation failed' }, { status: 500 });
    }
}
