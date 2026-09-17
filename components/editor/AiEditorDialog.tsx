"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { Loader2, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResultVideo } from '@/remotion/ResultVideo';
import { applyEditPlan, editPlanSchema, getEditChanges, sameProject, type EditorProject, type EditPlan } from '@/lib/ai-edit';
import type { AiProvider } from '@/lib/ai-provider';

type Proposal = { original: EditorProject; result: EditorProject; plan: EditPlan; selectedIds?: string[]; frame: number };
type Props = {
    project: EditorProject;
    selectedClipId: string | null;
    currentFrame: number;
    onOpenChange: (open: boolean) => void;
    onApply: (original: EditorProject, plan: EditPlan, selectedIds?: string[]) => void;
};
const fieldNames: Record<string, string> = {
    content: '内容', title: '名前', startFrame: '開始フレーム', durationInFrames: '長さ（フレーム）', trackId: 'トラック',
    x: '横位置', y: '縦位置', width: '幅', height: '高さ', rotate: '回転', mirror: '左右反転',
    volume: '音量', playbackRate: '再生速度', mediaStartOffset: '素材の開始位置', animation: 'アニメーション',
    keyframes: 'キーフレーム', effects: 'エフェクト', language: 'コードの言語', steps: 'コードの切り替え',
    color: '文字色', backgroundColor: '背景色', background: '背景', fontSize: '文字サイズ', fontFamily: 'フォント',
    fontWeight: '文字の太さ', textAlign: '文字の配置', lineHeight: '行間', opacity: '不透明度', padding: '余白',
    borderRadius: '角丸', borderColor: '枠線の色', borderWidth: '枠線の太さ', borderStyle: '枠線', textShadow: '文字の影',
};
const displayValue = (value: unknown) => value === undefined || value === null ? '未設定' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

export function AiEditorDialog({ project, selectedClipId, currentFrame, onOpenChange, onApply }: Props) {
    const [prompt, setPrompt] = useState('');
    const [scope, setScope] = useState<'all' | 'selected'>('all');
    const [provider, setProvider] = useState<AiProvider>('openai');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [proposal, setProposal] = useState<Proposal | null>(null);
    const [previewMode, setPreviewMode] = useState<'before' | 'after'>('after');
    const requestRef = useRef<AbortController | null>(null);
    useEffect(() => () => { requestRef.current?.abort(); requestRef.current = null; }, []);

    const selected = project.clips.find(clip => clip.id === selectedClipId);
    const stale = proposal !== null && !sameProject(project, proposal.original);
    const changes = useMemo(() => proposal ? getEditChanges(proposal.original, proposal.plan) : [], [proposal]);
    const preview = proposal && (previewMode === 'before' ? proposal.original : proposal.result);
    const duration = preview ? Math.max(1, ...preview.clips.map(clip => clip.startFrame + clip.durationInFrames)) : 1;

    const generate = async () => {
        if (requestRef.current || !prompt.trim() || (scope === 'selected' && !selected)) return;
        const controller = new AbortController();
        requestRef.current = controller;
        setLoading(true);
        setError('');
        setProposal(null);
        try {
            const original = structuredClone(project);
            const selectedIds = scope === 'selected' ? [selected!.id] : undefined;
            const response = await fetch('/api/ai/edit', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
                body: JSON.stringify({ prompt, project: original, selectedIds, currentFrame, provider, apiKey, model: provider === 'commandcode' ? model : undefined }),
            });
            const data = await response.json();
            if (controller.signal.aborted || requestRef.current !== controller) return;
            if (!response.ok) throw new Error([data.error || '編集案を作成できませんでした。', ...(Array.isArray(data.issues) ? data.issues.slice(0, 5) : [])].join('\n'));
            const plan = editPlanSchema.parse(data.plan);
            const result = applyEditPlan(original, plan, selectedIds);
            setPreviewMode('after');
            setProposal({ original, result, plan, selectedIds, frame: currentFrame });
        } catch (error) {
            if (!controller.signal.aborted && requestRef.current === controller) setError(error instanceof Error ? error.message : '編集案を作成できませんでした。');
        } finally {
            if (requestRef.current === controller) { requestRef.current = null; setLoading(false); }
        }
    };
    const cancel = () => {
        requestRef.current?.abort();
        requestRef.current = null;
        setLoading(false);
    };
    const apply = () => {
        if (!proposal || stale || loading) return;
        try {
            onApply(proposal.original, proposal.plan, proposal.selectedIds);
            onOpenChange(false);
        } catch (error) { setError(error instanceof Error ? error.message : '変更を適用できませんでした。'); }
    };

    return <Dialog open onOpenChange={open => { if (!open) cancel(); onOpenChange(open); }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>編集中の動画をAIで編集</DialogTitle>
                <DialogDescription>編集内容を指示すると、現在のタイムラインから変更案を作ります。比較して「変更を適用」を押すと反映されます。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <fieldset disabled={loading} className="space-y-4 disabled:opacity-60">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                        <span>編集対象</span>
                        <label className="flex items-center gap-2"><input type="radio" name="ai-edit-scope" checked={scope === 'all'} onChange={() => { setScope('all'); setProposal(null); }} />動画全体</label>
                        <label className="flex items-center gap-2"><input type="radio" name="ai-edit-scope" checked={scope === 'selected'} disabled={!selected} onChange={() => { setScope('selected'); setProposal(null); }} />選択中のクリップのみ</label>
                    </div>
                    {scope === 'selected' && <p className="text-xs text-muted-foreground break-all">{selected ? selected.title || selected.content.slice(0, 80) : 'クリップが選択されていません。'}</p>}
                    <label className="block space-y-2 text-sm">
                        <span>どのように編集しますか？</span>
                        <Textarea value={prompt} maxLength={10000} rows={3} onChange={e => { setPrompt(e.target.value); setProposal(null); }} placeholder="例：字幕を白文字・黒背景に統一して、画面下に配置して。BGMの音量を半分にして。" />
                    </label>
                    <details className="rounded-md border p-3 text-sm" open={!proposal || undefined}>
                        <summary className="cursor-pointer">AI設定</summary>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="space-y-1"><span>AIプロバイダー</span>
                                <select className="h-9 w-full rounded-md border bg-background px-3" value={provider} onChange={e => { setProvider(e.target.value as AiProvider); setApiKey(''); setProposal(null); }}>
                                    <option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="commandcode">Command Code</option>
                                </select>
                            </label>
                            <label className="space-y-1"><span>APIキー</span><Input type="password" autoComplete="off" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="サーバーに設定済みなら省略可" /></label>
                            {provider === 'commandcode' && <label className="space-y-1 sm:col-span-2"><span>Model ID</span><Input value={model} onChange={e => setModel(e.target.value)} placeholder="deepseek/deepseek-v4-flash" /></label>}
                        </div>
                    </details>
                </fieldset>
                <p className="text-xs text-muted-foreground">字幕・配置・表示時間・音量などを編集できます。字幕の変更で音声は再生成されません。PSDのレイヤー選択と口パク設定は保持します。現在のタイムライン情報を選択したAIへ送信します。</p>
                {error && <p role="alert" className="whitespace-pre-wrap text-sm text-destructive">{error}</p>}
                {loading && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />編集案を作成・検証中です。重なりなどがあればAIに修正を依頼します。</p>}
                {proposal && <section className="space-y-3 border-t pt-4" aria-label="AIの変更案">
                    <p className="text-sm font-medium whitespace-pre-wrap">{proposal.plan.summary}</p>
                    {stale && <p role="alert" className="text-sm text-destructive">タイムラインが変更されました。最新の状態から編集案を作り直してください。</p>}
                    <div className="flex gap-2">
                        <Button size="sm" variant={previewMode === 'before' ? 'default' : 'outline'} onClick={() => setPreviewMode('before')}>変更前</Button>
                        <Button size="sm" variant={previewMode === 'after' ? 'default' : 'outline'} onClick={() => setPreviewMode('after')}>変更後</Button>
                    </div>
                    {preview && <Player key={`${previewMode}-${proposal.plan.summary}`} component={ResultVideo} inputProps={{ clips: preview.clips, primaryColor: preview.primaryColor }}
                        compositionWidth={1280} compositionHeight={720} fps={30} durationInFrames={duration} initialFrame={Math.min(proposal.frame, duration - 1)}
                        controls style={{ width: '100%', borderRadius: 8 }} />}
                    <div className="max-h-64 overflow-y-auto space-y-2">
                        {changes.map((change, index) => <details key={index} className="rounded-md border p-3 text-sm">
                            <summary className="cursor-pointer break-all">{({ update: '変更', add: '追加', delete: '削除' })[change.type]}：{change.label}</summary>
                            <p className="my-2 text-muted-foreground">{change.reason}</p>
                            <table className="w-full table-fixed text-xs"><thead><tr><th className="w-1/5 text-left">項目</th><th className="text-left">変更前</th><th className="text-left">変更後</th></tr></thead>
                                <tbody>{change.fields.map((field, i) => <tr key={i} className="border-t align-top"><td className="py-2 pr-2 break-words">{fieldNames[field.field] || field.field}</td><td className="py-2 pr-2 whitespace-pre-wrap break-words">{displayValue(field.before)}</td><td className="py-2 whitespace-pre-wrap break-words">{displayValue(field.after)}</td></tr>)}</tbody>
                            </table>
                        </details>)}
                    </div>
                </section>}
            </div>
            <DialogFooter>
                {loading ? <Button variant="outline" onClick={cancel}>作成を中止</Button> : <Button variant="outline" onClick={() => onOpenChange(false)}>閉じる</Button>}
                <Button variant="outline" onClick={generate} disabled={loading || !prompt.trim() || !project.clips.length || (scope === 'selected' && !selected)}><Sparkles className="mr-2 size-4" />{proposal ? '編集案を作り直す' : '編集案を作成'}</Button>
                {proposal && <Button onClick={apply} disabled={loading || stale}>変更を適用</Button>}
            </DialogFooter>
        </DialogContent>
    </Dialog>;
}
