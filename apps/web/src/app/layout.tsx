import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { AppNav } from '@/components/AppNav';
import { StoryBanner } from '@/components/story/StoryBanner';

export const metadata: Metadata = {
  title: 'Benefits Portal — Secured by Okta for AI',
  description: 'HR Benefits AI Agent — ID-JAG token exchange demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>
        <Suspense fallback={null}>
          <AppNav />
        </Suspense>
        {/* Offset for fixed sidebar (248px) + top bar (64px) */}
        <main style={{ marginLeft: 248, paddingTop: 64, minHeight: '100vh' }}>
          {children}
        </main>
        <Suspense fallback={null}>
          <StoryBanner />
        </Suspense>
      </body>
    </html>
  );
}
