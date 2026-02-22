/** 相対URLを絶対URLに変換（エクスポート時はRemotionが別サーバーで動くため必要） */
export function resolveAssetUrl(url: string, baseUrl?: string): string {
    if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return base ? `${base.replace(/\/$/, '')}${url.startsWith('/') ? url : '/' + url}` : url;
}
