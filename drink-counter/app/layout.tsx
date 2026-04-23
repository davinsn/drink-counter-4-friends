import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pint for Pint',
  description: 'Realtime room-based drink counter for friends',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
