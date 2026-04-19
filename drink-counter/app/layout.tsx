import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Drink Counter',
  description: 'Drink counter app with leaderboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}