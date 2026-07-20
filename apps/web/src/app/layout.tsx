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
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <AppNav />
        </Suspense>
        <main style={{ minHeight: 'calc(100vh - 52px)' }}>
          {children}
        </main>
        <Suspense fallback={null}>
          <StoryBanner />
        </Suspense>
      </body>
    </html>
  );
}
