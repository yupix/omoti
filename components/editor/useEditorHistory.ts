"use client";

import { useRef, useEffect, useCallback } from 'react';
import { Clip, Track } from '@/types';
import { recordHistory } from '@/lib/editor-history';
import type { EditorProject } from '@/lib/ai-edit';

interface HistoryState {
    clips: Clip[];
    tracks: Track[];
    primaryColor: string;
}

export function useEditorHistory({
    clips,
    tracks,
    primaryColor,
    setClips,
    setTracks,
    setPrimaryColor,
    isLoaded,
}: {
    clips: Clip[];
    tracks: Track[];
    primaryColor: string;
    setClips: React.Dispatch<React.SetStateAction<Clip[]>>;
    setTracks: React.Dispatch<React.SetStateAction<Track[]>>;
    setPrimaryColor: (color: string) => void;
    isLoaded: boolean;
}) {
    const historyRef = useRef<HistoryState[]>([]);
    const historyIndexRef = useRef(-1);
    const isNavigatingHistoryRef = useRef(false);

    // Save history whenever state changes (unless we are undoing/redoing)
    // Debounced to prevent saving thousands of states when dragging/cropping
    useEffect(() => {
        if (!isLoaded) return;
        if (isNavigatingHistoryRef.current) {
            isNavigatingHistoryRef.current = false;
            return;
        }

        const timeout = setTimeout(() => {
            const currentState = { clips, tracks, primaryColor };

            const history = recordHistory(historyRef.current, historyIndexRef.current, currentState);
            historyRef.current = history.states;
            historyIndexRef.current = history.index;
        }, 500);

        return () => clearTimeout(timeout);
    }, [clips, tracks, primaryColor, isLoaded]);

    const undo = useCallback(() => {
        if (historyIndexRef.current > 0) {
            isNavigatingHistoryRef.current = true;
            historyIndexRef.current--;
            const previousState = historyRef.current[historyIndexRef.current];
            setClips(previousState.clips);
            setTracks(previousState.tracks);
            setPrimaryColor(previousState.primaryColor);
        }
    }, [setClips, setTracks, setPrimaryColor]);

    const redo = useCallback(() => {
        if (historyIndexRef.current < historyRef.current.length - 1) {
            isNavigatingHistoryRef.current = true;
            historyIndexRef.current++;
            const nextState = historyRef.current[historyIndexRef.current];
            setClips(nextState.clips);
            setTracks(nextState.tracks);
            setPrimaryColor(nextState.primaryColor);
        }
    }, [setClips, setTracks, setPrimaryColor]);

    // Capture both sides immediately so even Ctrl+Z before the debounce can undo the whole edit.
    const recordImmediate = useCallback((current: EditorProject, next: EditorProject) => {
        const history = recordHistory(historyRef.current, historyIndexRef.current, current, next);
        historyRef.current = history.states;
        historyIndexRef.current = history.index;
        isNavigatingHistoryRef.current = true;
    }, []);

    return { undo, redo, recordImmediate };
}
