import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const viewport: Viewport = {
  themeColor: '#10b981',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'ZapTube | Türk Futbol YouTube Kumandası',
  description:
    'Türkiye\'deki futbol yorum YouTube kanallarını tek bir arayüzde keşfet. Takımını seç, içerik tipini belirle, doğru kanala ulaş. Zap yap, izle!',
  keywords: ['türk futbol', 'youtube', 'galatasaray', 'fenerbahçe', 'beşiktaş', 'trabzonspor', 'süper lig'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ZapTube',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adsenseId = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_ID;

  return (
    <html lang="tr">
      <head>
        {adsenseId && (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className="min-h-screen bg-[#111827] antialiased">
        {children}
      </body>
    </html>
  );
}
