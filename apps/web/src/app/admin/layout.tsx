'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const adminNav = [
  { href: '/admin', label: '系统概览', icon: '📊' },
  { href: '/admin/users', label: '用户管理', icon: '👥' },
  { href: '/admin/school', label: '学校设置', icon: '🏫' },
  { href: '/admin/ai-config', label: 'AI 配置', icon: '🤖' },
  { href: '/admin/plugins', label: '插件管理', icon: '🧩' },
  { href: '/admin/monitor', label: '系统监控', icon: '📈' },
  { href: '/admin/settings', label: '系统设置', icon: '⚙️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const u = JSON.parse(stored);
    if (u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN') { router.push('/dashboard'); return; }
    setUser(u);
  }, [router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 顶栏 */}
      <header className="bg-gray-800 border-b border-gray-700 fixed top-0 left-0 right-0 z-30 h-14 flex items-center px-4 justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1 text-gray-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Link href="/admin" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">E</div>
            <span className="font-bold text-lg hidden sm:inline">EduForge Admin</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">{user.name}</span>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">返回面板</Link>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="text-sm text-gray-400 hover:text-white">退出</button>
        </div>
      </header>

      {/* 侧边栏 */}
      <aside className={`fixed top-14 left-0 bottom-0 w-56 bg-gray-800 border-r border-gray-700 z-20 transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <nav className="p-3 space-y-1">
          {adminNav.map(item => {
            const active = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${active ? 'bg-blue-600/20 text-blue-400' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 遮罩 */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-10 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* 主内容 */}
      <main className="lg:ml-56 mt-14 p-4 sm:p-6">{children}</main>
    </div>
  );
}
