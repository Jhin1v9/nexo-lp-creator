import React from 'react'
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '{{BRAND_NAME}} — {{TAGLINE}}',
  description: '{{META_DESCRIPTION}}',
  openGraph: {
    title: '{{BRAND_NAME}} — {{TAGLINE}}',
    description: '{{META_DESCRIPTION}}',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '{{BRAND_NAME}} — {{TAGLINE}}',
    description: '{{META_DESCRIPTION}}',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased text-slate-800 bg-white">
        {children}
      </body>
    </html>
  );
}