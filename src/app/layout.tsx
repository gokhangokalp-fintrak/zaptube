import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZapTube | Türk Futbol YouTube Kumandası',
  description:
    'Türkiye\'deki futbol yorum YouTube kanallarını tek bir arayüzde keşfet. Takımını seç, içerik tipini belirle, doğru kanala ulaş. Zap yap, izle!',
  keywords: ['türk futbol', 'youtube', 'galatasaray', 'fenerbahçe', 'beşiktaş', 'trabzonspor', 'süper lig'],
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
