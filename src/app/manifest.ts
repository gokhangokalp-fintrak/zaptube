import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ZapTube — Türk Futbol YouTube Kumandası',
    short_name: 'ZapTube',
    description: 'Türkiye futbol YouTube kanallarını tek yerden izle. Zap yap, doğru kanala ulaş!',
    start_url: '/app',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#10b981',
    orientation: 'portrait-primary',
    categories: ['sports', 'entertainment'],
    lang: 'tr',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/screenshots/desktop.png',
        sizes: '1280x720',
        type: 'image/png',
        // @ts-ignore - form_factor is valid but not in TS types yet
        form_factor: 'wide',
      },
      {
        src: '/screenshots/mobile.png',
        sizes: '390x844',
        type: 'image/png',
        // @ts-ignore
        form_factor: 'narrow',
      },
    ],
  };
}
