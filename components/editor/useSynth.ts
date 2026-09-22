"use client";

import { useState, useEffect } from 'react';
import { getAIVoicePresets } from '@/lib/aivoice';
import { getVoicevoxSpeakers, VoicevoxSpeaker } from '@/lib/voicevox';
import { getCevioaiSpeakers, CevioaiSpeaker } from '@/lib/cevioai';

export type SynthProvider = 'aivoice' | 'voicevox' | 'cevioai';

export function useSynth() {
    const [synthProvider, setSynthProvider] = useState<SynthProvider>('aivoice');
    const [aivoiceBaseUrl, setAivoiceBaseUrl] = useState('http://localhost:8000');
    const [voicevoxBaseUrl, setVoicevoxBaseUrl] = useState('http://localhost:50021');
    const [cevioaiBaseUrl, setCevioaiBaseUrl] = useState('http://localhost:8001');
    const [voicevoxSpeakers, setVoicevoxSpeakers] = useState<VoicevoxSpeaker[]>([]);
    const [cevioaiSpeakers, setCevioaiSpeakers] = useState<CevioaiSpeaker[]>([]);
    const [selectedVoicevoxSpeaker, setSelectedVoicevoxSpeaker] = useState<string>('');
    const [selectedVoicevoxStyle, setSelectedVoicevoxStyle] = useState<number>(0);
    const [selectedCevioaiSpeaker, setSelectedCevioaiSpeaker] = useState<string>('');
    const [aiVoicePresets, setAiVoicePresets] = useState<string[]>([]);
    const [selectedAiVoicePreset, setSelectedAiVoicePreset] = useState<string>('');
    const [isSynthesizing, setIsSynthesizing] = useState(false);

    // Fetch Synth Presets/Speakers with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (synthProvider === 'aivoice') {
                if (!aivoiceBaseUrl) return;
                setAiVoicePresets([]); // Clear current
                getAIVoicePresets(aivoiceBaseUrl).then(presets => {
                    setAiVoicePresets(presets);
                    if (presets.length > 0 && !selectedAiVoicePreset) setSelectedAiVoicePreset(presets[0]);
                });
            } else if (synthProvider === 'cevioai') {
                if (!cevioaiBaseUrl) return;
                setCevioaiSpeakers([]);
                getCevioaiSpeakers(cevioaiBaseUrl).then((speakers) => {
                    setCevioaiSpeakers(speakers);
                    if (speakers.length > 0) {
                        const exists = speakers.some((s) => s.speaker_uuid === selectedCevioaiSpeaker);
                        if (!exists) setSelectedCevioaiSpeaker(speakers[0].speaker_uuid);
                    }
                });
            } else {
                if (!voicevoxBaseUrl) return;
                setVoicevoxSpeakers([]); // Clear current
                getVoicevoxSpeakers(voicevoxBaseUrl).then(speakers => {
                    setVoicevoxSpeakers(speakers);
                    if (speakers.length > 0) {
                        // Keep current if still exists, otherwise reset
                        const exists = speakers.some(s => s.speaker_uuid === selectedVoicevoxSpeaker);
                        if (!exists) {
                            setSelectedVoicevoxSpeaker(speakers[0].speaker_uuid);
                            if (speakers[0].styles.length > 0) setSelectedVoicevoxStyle(speakers[0].styles[0].id);
                        }
                    }
                });
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timer);
    }, [synthProvider, aivoiceBaseUrl, voicevoxBaseUrl, cevioaiBaseUrl, selectedVoicevoxSpeaker, selectedAiVoicePreset, selectedCevioaiSpeaker]);

    return {
        synthProvider,
        setSynthProvider,
        aivoiceBaseUrl,
        setAivoiceBaseUrl,
        voicevoxBaseUrl,
        setVoicevoxBaseUrl,
        cevioaiBaseUrl,
        setCevioaiBaseUrl,
        voicevoxSpeakers,
        cevioaiSpeakers,
        selectedVoicevoxSpeaker,
        setSelectedVoicevoxSpeaker,
        selectedVoicevoxStyle,
        setSelectedVoicevoxStyle,
        selectedCevioaiSpeaker,
        setSelectedCevioaiSpeaker,
        aiVoicePresets,
        selectedAiVoicePreset,
        setSelectedAiVoicePreset,
        isSynthesizing,
        setIsSynthesizing,
    };
}
