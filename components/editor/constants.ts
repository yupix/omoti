import { Clip, Track } from '@/types';

export const INITIAL_TRACKS: Track[] = [
    { id: 1, name: 'Foreground' },
    { id: 2, name: 'Main' },
    { id: 3, name: 'Background' },
];

export const INITIAL_CLIPS: Clip[] = [
    // Background
    {
        id: 'bg-gradient', type: 'shape', trackId: 3, startFrame: 0, durationInFrames: 510,
        content: 'rect', title: 'Background',
        x: 0, y: 0, width: 1280, height: 720,
        style: { background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' },
        animation: { type: 'none', duration: 0 }
    },

    // Scene 1: Introduction (Akane)
    {
        id: 'intro-title', type: 'text', trackId: 1, startFrame: 0, durationInFrames: 60,
        content: 'React入門講座', title: 'Project Title',
        x: 340, y: 200, width: 600, height: 100,
        style: { color: '#61dafb', fontSize: '80px', fontFamily: 'Kaisei Tokumin', fontWeight: 'bold', textAlign: 'center' },
        animation: { type: 'pop', duration: 30 }
    },
    {
        id: 's1-akane', type: 'tachie', trackId: 2, startFrame: 30, durationInFrames: 120,
        content: '/uploads/1770692241459-_____SD___.psd', title: 'Akane (a)',
        x: -50, y: 150, width: 600, height: 600,
        animation: { type: 'slide', duration: 30 }
    },
    {
        id: 's1-sub', type: 'text', trackId: 1, startFrame: 40, durationInFrames: 110,
        content: 'こんにちは！茜です。\n今日はReactの基礎を解説するよ！', title: 'Subtitle 1',
        x: 400, y: 550, width: 700, height: 120,
        style: { color: '#ffffff', fontSize: '32px', fontFamily: 'Noto Sans JP', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '12px', padding: '20px' },
        animation: { type: 'fade', duration: 15 }
    },

    // Scene 2: Aoi explains Components
    {
        id: 's2-aoi', type: 'tachie', trackId: 2, startFrame: 150, durationInFrames: 120,
        content: '/uploads/1770692241459-_____SD___.psd', title: 'Aoi (aoi)',
        x: 730, y: 150, width: 600, height: 600,
        animation: { type: 'slide', duration: 30 }
    },
    {
        id: 's2-sub', type: 'text', trackId: 1, startFrame: 160, durationInFrames: 110,
        content: '葵だよ！Reactは「コンポーネント」を\n組み合わせて画面を作るのが特徴なんだ。', title: 'Subtitle 2',
        x: 200, y: 550, width: 700, height: 120,
        style: { color: '#ffffff', fontSize: '32px', fontFamily: 'Noto Sans JP', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '12px', padding: '20px' },
        animation: { type: 'fade', duration: 15 }
    },

    // Scene 3: Code Example
    {
        id: 's3-code', type: 'code', trackId: 3, startFrame: 270, durationInFrames: 120,
        content: 'function Welcome() {\n  return <h1>Hello, React!</h1>;\n}', title: 'React Code',
        x: 340, y: 150, width: 600, height: 350,
        language: 'tsx',
        steps: [
            { code: 'function Welcome() {\n  return <h1>Hello, React!</h1>;\n}', frameOffset: 0 }
        ],
        animation: { type: 'fade', duration: 20 }
    },
    {
        id: 's3-sub', type: 'text', trackId: 1, startFrame: 270, durationInFrames: 120,
        content: 'こんな風に、HTMLみたいな見た目を\nJavaScriptで書けるのが便利だよね。', title: 'Subtitle 3',
        x: 340, y: 550, width: 600, height: 120,
        style: { color: '#ffffff', fontSize: '32px', fontFamily: 'Noto Sans JP', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '12px', padding: '20px', textAlign: 'center' },
        animation: { type: 'fade', duration: 15 }
    },

    // Scene 4: Flow Chart
    {
        id: 's4-flow', type: 'flow', trackId: 3, startFrame: 390, durationInFrames: 120,
        content: 'Component Tree', title: 'Component Flow',
        x: 340, y: 150, width: 600, height: 350,
        nodes: [
            { id: 'app', data: { label: 'App' }, position: { x: 250, y: 20 }, style: { background: '#61dafb', color: '#000', fontWeight: 'bold' } },
            { id: 'header', data: { label: 'Header' }, position: { x: 100, y: 150 }, style: { background: '#fff', color: '#000' } },
            { id: 'main', data: { label: 'Main' }, position: { x: 400, y: 150 }, style: { background: '#fff', color: '#000' } },
        ],
        edges: [
            { id: 'e1', source: 'app', target: 'header', animated: true },
            { id: 'e2', source: 'app', target: 'main', animated: true },
        ],
        animation: { type: 'fade', duration: 20 }
    },

    // Scene 5: Outro
    {
        id: 's5-both-text', type: 'text', trackId: 1, startFrame: 450, durationInFrames: 60,
        content: '一緒にマスターしよう！', title: 'Closing',
        x: 340, y: 250, width: 600, height: 100,
        style: { color: '#ffffff', fontSize: '48px', fontFamily: 'Kaisei Tokumin', textAlign: 'center', fontWeight: 'bold' },
        animation: { type: 'pop', duration: 20 }
    },

    // Global Audio
    {
        id: 'bg-music', type: 'audio', trackId: 3, startFrame: 0, durationInFrames: 510,
        content: 'https://actions.google.com/sounds/v1/science_fiction/stinger_heavy_transition.ogg', title: 'BGM',
        animation: { type: 'none', duration: 0 }
    }
];
