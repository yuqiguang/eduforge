'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [plugins, setPlugins] = useState<any[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const u = JSON.parse(stored);
    if (u.role !== 'ADMIN' && u.role !== 'SUPER_ADMIN') { router.push('/dashboard'); return; }
    setUser(u);
    apiFetch('/api/plugins').then(setPlugins).catch(() => {});
  }, [router]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">E</div>
          <span className="font-bold text-lg">EduForge Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white">← 返回面板</Link>
          <button onClick={() => { localStorage.clear(); router.push('/login'); }}
            className="text-sm text-gray-400 hover:text-white">退出</button>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-8">系统管理</h1>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <AdminCard title="👥 用户管理" desc="管理教师和学生账号" />
          <AdminCard title="🏫 学校设置" desc="学校信息和组织结构" />
          <AdminCard title="🤖 AI 配置" desc="大模型和用量管理" />
          <AdminCard title="🧩 插件管理" desc="安装和配置插件" />
          <AdminCard title="📊 系统监控" desc="查看系统运行状态" />
          <AdminCard title="⚙️ 系统设置" desc="全局参数配置" />
        </div>

        {/* 已加载插件 */}
        <div className="bg-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold mb-4">已加载插件</h2>
          <div className="space-y-2">
            {plugins.map((p: any) => (
              <div key={p.name} className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-3">
                <div>
                  <span className="font-medium">{p.displayName || p.name}</span>
                  <span className="ml-2 text-xs text-gray-400">v{p.version}</span>
                  {p.description && <span className="ml-3 text-sm text-gray-400">{p.description}</span>}
                </div>
                <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded-full">运行中</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function AdminCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 hover:bg-gray-750 transition cursor-pointer border border-gray-700">
      <h3 className="font-bold mb-1">{title}</h3>
      <p className="text-sm text-gray-400">{desc}</p>
    </div>
  );
}
