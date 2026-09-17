/** 相対URLを絶対URLに変換（エクスポート時はRemotionが別サーバーで動くため必要） */
export function resolveAssetUrl(url: string, baseUrl?: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
    // Old projects stored absolute localhost upload URLs. Resolve those against
    // the current app/export server when the editor is opened from another host.
    if (/^https?:\/\//i.test(url)) {
        const parsed = new URL(url);
        if (parsed.pathname.startsWith('/uploads/') &&
            (['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || parsed.origin === origin)) {
            url = parsed.pathname + parsed.search;
        }
    }
    if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
        return url;
    }
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
    return base ? `${base.replace(/\/$/, '')}${url.startsWith('/') ? url : '/' + url}` : url;
}
