# Futbol Kumandasi

Turk futbol YouTube kanallarini tek bir arayuzde toplayan web uygulamasi.

## Kurulum

```bash
npm install
```

## Calistirma

```bash
# .env.local dosyasi olustur
cp .env.local.example .env.local
# YouTube API key'ini .env.local'a ekle

# Gelistirme sunucusunu baslat
npm run dev
```

## YouTube API Key

1. [Google Cloud Console](https://console.cloud.google.com/) adresine git
2. Yeni proje olustur veya mevcut projeyi sec
3. YouTube Data API v3'u etkinlestir
4. Credentials > API Key olustur
5. Key'i `.env.local` dosyasina ekle

## Vercel Deploy

```bash
npm run build
# veya Vercel CLI ile:
vercel
```

Vercel dashboard'dan `NEXT_PUBLIC_YOUTUBE_API_KEY` environment variable'ini ekle.

## Teknolojiler

- Next.js 14
- React 18
- Tailwind CSS
- YouTube Data API v3
- TypeScript
