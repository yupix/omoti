
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

export async function POST(req: NextRequest) {
    try {
        const { prompt, preset = "琴葉 茜", apiKey, provider = 'openai', tachieUrl, tachieLayers } = await req.json();

        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        let scriptData;

        let layerContext = "";
        if (tachieLayers && tachieLayers.length > 0) {
            layerContext = `
            AVAILABLE PSD LAYERS:
            ${JSON.stringify(tachieLayers)}

            INSTRUCTIONS FOR TACHIE (CHARACTER):
            1. You MUST generate a "tachieConfig" object in the JSON root.
            2. "tachieConfig" should map keys "neutral", "happy", "sad", "surprised", "serious" to an ARRAY of layer names strings from the provided list.
            3. Identify base layers (Body, Hair, Clothes) that should be present in ALL emotions.
            4. Identify expression layers (Eyes, Mouth, Eyebrow) for each emotion.
            5. Combine Base + Expression layers for each key.
            6. IGNORE layers starting with "!" or keys that look like setup data unless necessary for rendering. (Actually, include all visible layers required).
            `;
        }

        const systemInstruction = `You are a video script generator for a tech tutorial channel.
            Generate a JSON structure for a short video explaining the user's topic.
            The output must strictly follow this JSON schema:
            {
              "title": "Video Title",
              "tachieConfig": {
                "neutral": ["Layer/Path/1", "Layer/Path/2"],
                "happy": ["Layer/Path/1", "Layer/Path/3"]
              },
              "scenes": [
                {
                  "text": "Spoken dialogue line (keep it concise, under 20 words)",
                  "action": "intro" | "explain" | "code" | "summary" | "outro",
                  "codeBlocks": [
                    { "code": "code snippet", "fileName": "App.tsx", "language": "tsx" }
                  ],
                  "previewContent": "HTML content. If demonstrating interactivity (e.g. clicking), include <script> to AUTOMATICALLY simulate action using setTimeout/setInterval. Do NOT wait for user input.",
                  "previewLayout": "split" | "overlay",
                  "previewDelay": 0.5,
                  "visualDescription": "Brief description of what to show",
                  "emotion": "neutral" | "happy" | "sad" | "surprised" | "serious"
                }
              ]
            }
            ${layerContext}
            Keep the total scenes between 5 and 10.
            Language: Japanese (unless requested otherwise).
            Use a friendly, energetic tone.
            TIP: If explaining interactions between multiple files (e.g. Parent & Child components), include BOTH in \`codeBlocks\` to display them simultaneously! Consumers love seeing related code side-by-side.
            TIP: To show the code first and then the result covering it, use "previewLayout": "overlay" and "previewDelay": 0.5.
            Emotions:
            - neutral: Standard explanation (use for facts)
            - happy: Encouraging, success (use for greetings, success)
            - sad: Problem, error (use for mentioning bugs/difficulties)
            - surprised: Interesting fact (use for 'did you know?')
            - serious: Important point (use for warnings/key concepts)
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
                title: `React Tutorial: ${prompt}`,
                scenes: [
                    { text: "こんにちは！AI生成機能（モック）で解説するよ。", action: "intro" },
                    { text: `GeminiやOpenAIを使って、${prompt}の動画を作れるんだ。`, action: "explain" },
                    { text: "APIキーを設定すれば、もっと詳しく解説できるよ！", action: "summary" },
                    { text: "ぜひ試してみてね。", action: "outro" }
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

        const PSD_PATH = "/uploads/1770692241459-_____SD___.psd";

        for (let i = 0; i < scriptData.scenes.length; i++) {
            const scene = scriptData.scenes[i];

            // 1. Generate Audio
            let audioUrl = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';
            let duration = 3;

            try {
                const ttsRes = await fetch(`${AIVOICE_SERVER}/synthesize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: scene.text, preset })
                });

                if (ttsRes.ok) {
                    const ttsData = await ttsRes.json();
                    audioUrl = ttsData.url;
                    duration = Number(ttsData.duration) || 3;
                }
            } catch (err) {
                console.error("TTS Failed:", err);
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
                animation: { type: 'fade', duration: 5 }
            });

            // Character Clip (Akane or Custom)
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
            if (hasCode && hasPreview && !isOverlay) {
                // Tri-layout: Tachie (Left Edge) | Code (Center) | Preview (Right)
                tachieLayout = { x: -100, y: 220, width: 540, height: 540 };
            } else if (hasCode) {
                // Split-layout: Tachie (Left) | Code (Right)
                // If overlay, Code is centered, Tachie shifts left similarly to split mode
                tachieLayout = { x: 0, y: 150, width: 600, height: 600 };
            }

            if (scriptData.tachieConfig && (scriptData.tachieConfig[emotion] || scriptData.tachieConfig['neutral'])) {
                tachieLayers = scriptData.tachieConfig[emotion] || scriptData.tachieConfig['neutral'];
            } else {
                // Fallback: Hardcoded Akane Logic
                const AKANE_BASE_LAYERS = [
                    '琴葉姉妹',
                    '琴葉姉妹/!後ろ髪',
                    '琴葉姉妹/!後ろ髪/*あかねちゃん',
                    '琴葉姉妹/!後ろ髪/!もみあげ',
                    '琴葉姉妹/胴体',
                    '琴葉姉妹/胴体/*あかねちゃん',
                    '琴葉姉妹/胴体/*あかねちゃん/腕/!右腕/*下',
                    '琴葉姉妹/胴体/*あかねちゃん/腕/!左腕/*下',
                    '琴葉姉妹/胴体/*あかねちゃん/!胴体/!足/*立っている',
                    '琴葉姉妹/胴体/*あかねちゃん/!胴体/*下にしている',
                    '琴葉姉妹/胴体/*あかねちゃん/!装飾',
                    '琴葉姉妹/!素体',
                    '琴葉姉妹/ほっぺた/*上',
                    '琴葉姉妹/手前に出てる腕',
                    '琴葉姉妹/!前髪',
                    '琴葉姉妹/!前髪/*あかねちゃん',
                    '琴葉姉妹/!前髪/*あかねちゃん/!髪飾り右/*あかねちゃん',
                    '琴葉姉妹/!前髪/*あかねちゃん/*標準',
                    '琴葉姉妹/!表情'
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
            }

            // Only add slide animation for the first appearance or significant change
            clips.push({
                id: `char-${i}`,
                type: 'tachie',
                trackId: 2,
                startFrame: currentFrame,
                durationInFrames: totalSceneFrames, // Stay for padding
                content: tachieUrl || PSD_PATH,
                title: `Character (${emotion})`,
                x: tachieLayout.x,
                y: tachieLayout.y,
                width: tachieLayout.width,
                height: tachieLayout.height,
                tachieLayers: tachieLayers,
                animation: i === 0 ? { type: 'slide', duration: 20 } : { type: 'none', duration: 0 }
            });

            if (hasCode) {
                const availableHeight = 650;
                const startY = 50;
                const blockHeight = Math.floor(availableHeight / codeBlocks.length);
                // Adjust layout: when preview exists (and not overlay), move code left and widen it to prevent cutoff
                const codeX = (hasPreview && !isOverlay) ? 340 : 600;
                const codeWidth = (hasPreview && !isOverlay) ? 500 : 600;

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

                if (isOverlay) {
                    previewX = 600; // Center (cover code)
                    previewY = 150; // Align with code block top
                    previewWidth = 600; // Match code width
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
