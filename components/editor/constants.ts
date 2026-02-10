import { Clip, Track } from '@/types';

export const INITIAL_TRACKS: Track[] = [
    { id: 1, name: 'Text/Subtitles' },
    { id: 2, name: 'Characters' },
    { id: 3, name: 'Audio/BGM' },
    { id: 4, name: 'Overlays' },
];

export const INITIAL_CLIPS: Clip[] = [
    {
        "id": "bg-gradient",
        "type": "shape",
        "trackId": 3,
        "startFrame": 0,
        "durationInFrames": 690,
        "content": "rect",
        "title": "Background",
        "x": 0,
        "y": 0,
        "width": 1280,
        "height": 720,
        "style": {
            "background": "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
        },
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "title",
        "type": "text",
        "trackId": 1,
        "startFrame": 0,
        "durationInFrames": 60,
        "content": "React入門",
        "title": "Main Title",
        "x": 340,
        "y": 100,
        "width": 600,
        "height": 100,
        "style": {
            "color": "#61dafb",
            "fontSize": "80px",
            "fontWeight": "bold",
            "textAlign": "center",
            "fontFamily": "Inter"
        },
        "animation": {
            "type": "pop",
            "duration": 30
        }
    },
    {
        "id": "audio-0",
        "type": "audio",
        "trackId": 3,
        "startFrame": 0,
        "durationInFrames": 90,
        "content": "http://localhost:8000/static/audio/95c3f875-14ab-4a63-bd7d-2dfa4f861602.wav",
        "title": "Voice 1",
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "tachie-0",
        "type": "tachie",
        "trackId": 2,
        "startFrame": 0,
        "durationInFrames": 105,
        "content": "/uploads/1770692241459-_____SD___.psd",
        "title": "Akane",
        "x": 50,
        "y": 150,
        "width": 600,
        "height": 600,
        "animation": {
            "type": "slide",
            "duration": 20
        }
    },
    {
        "id": "sub-0",
        "type": "text",
        "trackId": 1,
        "startFrame": 0,
        "durationInFrames": 90,
        "content": "こんにちは！おもちエディタへようこそ。",
        "title": "Subtitle",
        "x": 290,
        "y": 560,
        "width": 900,
        "height": 120,
        "style": {
            "color": "#ffffff",
            "fontSize": "32px",
            "fontFamily": "Noto Sans JP",
            "backgroundColor": "rgba(0,0,0,0.7)",
            "borderRadius": "16px",
            "padding": "24px",
            "textAlign": "center",
            "boxShadow": "0 4px 6px rgba(0,0,0,0.3)"
        },
        "animation": {
            "type": "fade",
            "duration": 10
        }
    },
    {
        "id": "audio-1",
        "type": "audio",
        "trackId": 3,
        "startFrame": 105,
        "durationInFrames": 90,
        "content": "http://localhost:8000/static/audio/3f745680-a079-4af7-babd-bc9a1ace1c88.wav",
        "title": "Voice 2",
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "tachie-1",
        "type": "tachie",
        "trackId": 2,
        "startFrame": 105,
        "durationInFrames": 105,
        "content": "/uploads/1770692241459-_____SD___.psd",
        "title": "Akane",
        "x": 50,
        "y": 150,
        "width": 600,
        "height": 600,
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "sub-1",
        "type": "text",
        "trackId": 1,
        "startFrame": 105,
        "durationInFrames": 90,
        "content": "今日はReactの基礎について解説していくよ。",
        "title": "Subtitle",
        "x": 290,
        "y": 560,
        "width": 900,
        "height": 120,
        "style": {
            "color": "#ffffff",
            "fontSize": "32px",
            "fontFamily": "Noto Sans JP",
            "backgroundColor": "rgba(0,0,0,0.7)",
            "borderRadius": "16px",
            "padding": "24px",
            "textAlign": "center",
            "boxShadow": "0 4px 6px rgba(0,0,0,0.3)"
        },
        "animation": {
            "type": "fade",
            "duration": 10
        }
    },
    {
        "id": "audio-2",
        "type": "audio",
        "trackId": 3,
        "startFrame": 210,
        "durationInFrames": 90,
        "content": "http://localhost:8000/static/audio/0abff431-b832-476b-897a-fe39a23240d0.wav",
        "title": "Voice 3",
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "tachie-2",
        "type": "tachie",
        "trackId": 2,
        "startFrame": 210,
        "durationInFrames": 105,
        "content": "/uploads/1770692241459-_____SD___.psd",
        "title": "Akane",
        "x": 50,
        "y": 150,
        "width": 600,
        "height": 600,
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "sub-2",
        "type": "text",
        "trackId": 1,
        "startFrame": 210,
        "durationInFrames": 90,
        "content": "Reactは、コンポーネントという部品を組み合わせて画面を作るんだ。",
        "title": "Subtitle",
        "x": 290,
        "y": 560,
        "width": 900,
        "height": 120,
        "style": {
            "color": "#ffffff",
            "fontSize": "32px",
            "fontFamily": "Noto Sans JP",
            "backgroundColor": "rgba(0,0,0,0.7)",
            "borderRadius": "16px",
            "padding": "24px",
            "textAlign": "center",
            "boxShadow": "0 4px 6px rgba(0,0,0,0.3)"
        },
        "animation": {
            "type": "fade",
            "duration": 10
        }
    },
    {
        "id": "code-demo",
        "type": "code",
        "trackId": 4,
        "startFrame": 210,
        "durationInFrames": 240,
        "content": "function App() {\n  return <h1>Hello</h1>;\n}",
        "title": "Code Sample",
        "x": 600,
        "y": 200,
        "width": 500,
        "height": 300,
        "language": "tsx",
        "steps": [
            {
                "code": "function App() {\n  return <h1>Hello</h1>;\n}",
                "frameOffset": 0
            }
        ],
        "animation": {
            "type": "pop",
            "duration": 20
        }
    },
    {
        "id": "audio-3",
        "type": "audio",
        "trackId": 3,
        "startFrame": 315,
        "durationInFrames": 90,
        "content": "http://localhost:8000/static/audio/8f19f1c1-0fd7-4a30-89be-0d47c69f5dea.wav",
        "title": "Voice 4",
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "tachie-3",
        "type": "tachie",
        "trackId": 2,
        "startFrame": 315,
        "durationInFrames": 105,
        "content": "/uploads/1770692241459-_____SD___.psd",
        "title": "Akane",
        "x": 50,
        "y": 150,
        "width": 600,
        "height": 600,
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "sub-3",
        "type": "text",
        "trackId": 1,
        "startFrame": 315,
        "durationInFrames": 90,
        "content": "例えば、ボタンやヘッダーを一つの部品として定義するよ。",
        "title": "Subtitle",
        "x": 290,
        "y": 560,
        "width": 900,
        "height": 120,
        "style": {
            "color": "#ffffff",
            "fontSize": "32px",
            "fontFamily": "Noto Sans JP",
            "backgroundColor": "rgba(0,0,0,0.7)",
            "borderRadius": "16px",
            "padding": "24px",
            "textAlign": "center",
            "boxShadow": "0 4px 6px rgba(0,0,0,0.3)"
        },
        "animation": {
            "type": "fade",
            "duration": 10
        }
    },
    {
        "id": "audio-4",
        "type": "audio",
        "trackId": 3,
        "startFrame": 420,
        "durationInFrames": 90,
        "content": "http://localhost:8000/static/audio/6542a8ae-e9c9-487e-b4b5-98e10a16419c.wav",
        "title": "Voice 5",
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "tachie-4",
        "type": "tachie",
        "trackId": 2,
        "startFrame": 420,
        "durationInFrames": 105,
        "content": "/uploads/1770692241459-_____SD___.psd",
        "title": "Akane",
        "x": 50,
        "y": 150,
        "width": 600,
        "height": 600,
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "sub-4",
        "type": "text",
        "trackId": 1,
        "startFrame": 420,
        "durationInFrames": 90,
        "content": "それらを並べるだけで、複雑な画面も簡単に作れちゃうんだ。",
        "title": "Subtitle",
        "x": 290,
        "y": 560,
        "width": 900,
        "height": 120,
        "style": {
            "color": "#ffffff",
            "fontSize": "32px",
            "fontFamily": "Noto Sans JP",
            "backgroundColor": "rgba(0,0,0,0.7)",
            "borderRadius": "16px",
            "padding": "24px",
            "textAlign": "center",
            "boxShadow": "0 4px 6px rgba(0,0,0,0.3)"
        },
        "animation": {
            "type": "fade",
            "duration": 10
        }
    },
    {
        "id": "audio-5",
        "type": "audio",
        "trackId": 3,
        "startFrame": 525,
        "durationInFrames": 90,
        "content": "http://localhost:8000/static/audio/f376f6bd-675d-4784-9f8a-157eef9f7f9d.wav",
        "title": "Voice 6",
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "tachie-5",
        "type": "tachie",
        "trackId": 2,
        "startFrame": 525,
        "durationInFrames": 105,
        "content": "/uploads/1770692241459-_____SD___.psd",
        "title": "Akane",
        "x": 50,
        "y": 150,
        "width": 600,
        "height": 600,
        "animation": {
            "type": "none",
            "duration": 0
        }
    },
    {
        "id": "sub-5",
        "type": "text",
        "trackId": 1,
        "startFrame": 525,
        "durationInFrames": 90,
        "content": "便利そうだよね！これから一緒に学んでいこう！",
        "title": "Subtitle",
        "x": 290,
        "y": 560,
        "width": 900,
        "height": 120,
        "style": {
            "color": "#ffffff",
            "fontSize": "32px",
            "fontFamily": "Noto Sans JP",
            "backgroundColor": "rgba(0,0,0,0.7)",
            "borderRadius": "16px",
            "padding": "24px",
            "textAlign": "center",
            "boxShadow": "0 4px 6px rgba(0,0,0,0.3)"
        },
        "animation": {
            "type": "fade",
            "duration": 10
        }
    }
];
