'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const teacherNav = [
  { href: '/dashboard', label: '概览', icon: '📊' },
  { href: '/dashboard/chat', label: 'AI 助手', icon: '🤖' },
  { href: '/dashboard/questions', label: '题库', icon: '📚' },
  { href: '/dashboard/assignments', label: '作业', icon: '📋' },
  { href: '/dashboard/classes', label: '班级', icon: '👥' },
  { href: '/dashboard/analytics', label: '学情分析', icon: '📈' },
  { href: '/dashboard/ai-settings', label: 'AI 设置', icon: '🤖' },
];

const studentNav = [
  { href: '/dashboard', label: '概览', icon: '📊' },
  { href: '/dashboard/chat', label: 'AI 助手', icon: '🤖' },
  { href: '/dashboard/my-assignments', label: '我的作业', icon: '📋' },
  { href: '/dashboard/mistakes', label: '错题本', icon: '❌' },
  { href: '/dashboard/progress', label: '学习进度', icon: '📈' },
];

const adminNav = [
  { href: '/dashboard', label: '概览', icon: '📊' },
  { href: '/dashboard/chat', label: 'AI 助手', icon: '🤖' },
  { href: '/dashboard/school', label: '学校管理', icon: '🏫' },
  { href: '/dashboard/classes', label: '班级管理', icon: '👥' },
  { href: '/dashboard/ai-settings', label: 'AI 设置', icon: '⚙️' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) {
      router.push('/login');
      return;
    }
    setUser(JSON.parse(stored));
  }, [router]);

  if (!user) return null;

  const nav = user.role === 'STUDENT' ? studentNav : user.role === 'ADMIN' ? adminNav : teacherNav;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶栏 */}
      <header className="bg-white border-b fixed top-0 left-0 right-0 z-30 h-14 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">E</div>
            <span className="font-bold text-lg hidden sm:inline">EduForge</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{user.name}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-600 font-medium">
            {user.role === 'TEACHER' ? '教师' : user.role === 'STUDENT' ? '学生' : user.role === 'ADMIN' ? '机构管理员' : '管理员'}
          </span>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="text-sm text-gray-400 hover:text-gray-600">退出</button>
        </div>
      </header>

      {/* 侧边栏 */}
      <aside className={`fixed top-14 left-0 bottom-0 w-56 bg-white border-r z-20 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <nav className="p-3 space-y-1">
          {nav.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${active ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 遮罩 */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/20 z-10 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* 主内容 */}
      <main className="lg:ml-56 mt-14 p-4 sm:p-6">{children}</main>
    </div>
  );
}
