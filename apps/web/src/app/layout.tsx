import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduForge - 开源教育 AI 引擎',
  description: '让每个学生都有 AI 老师',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
