"use client";

import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import type { UploadProgress } from '@/lib/upload';

export function UploadToast({
    progress,
    error,
    onCancel,
    onDismissError,
}: {
    progress: (UploadProgress & { name: string }) | null;
    error: string;
    onCancel: () => void;
    onDismissError: () => void;
}) {
    const { t } = useTranslation();

    if (!progress && !error) return null;

    return (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-lg border bg-background p-4 shadow-xl space-y-2">
            {progress ? <>
                <p className="text-sm font-medium truncate" title={progress.name}>{progress.name}</p>
                <p role="status" className="text-xs text-muted-foreground">
                    {t(`editor.assets.upload.${progress.phase}`)}
                    {progress.phase === 'uploading' && ` ${Math.round(progress.loaded / Math.max(1, progress.total) * 100)}% (${(progress.loaded / 1048576).toFixed(1)} / ${(progress.total / 1048576).toFixed(1)} MiB)`}
                </p>
                <progress aria-label={t('editor.assets.upload.uploading')} className="w-full" max={Math.max(1, progress.total)} value={progress.loaded} />
                <Button size="sm" variant="outline" onClick={onCancel}>{t('editor.assets.upload.cancel')}</Button>
            </> : <>
                <p role="alert" className="text-sm text-destructive">{error}</p>
                <Button size="sm" variant="outline" onClick={onDismissError}>{t('editor.assets.upload.close')}</Button>
            </>}
        </div>
    );
}
