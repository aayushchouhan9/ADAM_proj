import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sprintly — Sprint Board',
  description:
    'A premium Kanban sprint board with drag-and-drop, WIP limits, real-time collaboration, and data health tracking.',
  keywords: ['kanban', 'sprint', 'project management', 'productivity'],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} h-full dark`}>
      <body className="min-h-full flex flex-col bg-[#060312] text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
