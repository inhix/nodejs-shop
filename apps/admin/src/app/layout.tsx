import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'Адмін-панель',
  // Staff-only app: never indexed (also sent as an X-Robots-Tag header, see next.config.ts).
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
