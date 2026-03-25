import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ZapTube | Türk Futbol YouTube Kumandası',
  description:
    'Türkiye\'deki futbol yorum YouTube kanallarını tek bir arayüzde keşfet. Takımını seç, içerik tipini belirle, doğru kanala ulaş. Zap yap, izle!',
  keywords: ['türk futbol', 'youtube', 'galatasaray', 'fenerbahçe', 'beşiktaş', 'trabzonspor', 'süper lig'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen bg-[#111827] antialiased">
        {children}
      </body>
    </html>
  );
}
