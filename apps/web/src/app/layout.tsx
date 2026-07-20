import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { StoryBanner } from '@/components/story/StoryBanner';

export const metadata: Metadata = {
  title: 'Benefits Portal — Secured by Okta for AI',
  description: 'HR Benefits AI Agent demo',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-mono">
        {children}
        <Suspense fallback={null}>
          <StoryBanner />
        </Suspense>
      </body>
    </html>
  );
}
