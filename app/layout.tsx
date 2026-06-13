import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hirewave — hire for how they work with AI',
  description:
    'The two-sided AI-native hiring platform. Score candidates across 8 dimensions of AI collaboration that actually predict on-the-job performance.',
  metadataBase: new URL('https://hirewave.local'),
  openGraph: {
    title: 'Hirewave',
    description: 'Hire for how they work with AI, not how they work without it.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans antialiased selection:bg-violet-500/30 selection:text-white">
        {children}
      </body>
    </html>
  );
}
