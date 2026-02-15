'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

const cards = [
  { href: '/admin/users', icon: '👥', title: '用户管理', desc: '管理教师和学生账号' },
  { href: '/admin/school', icon: '🏫', title: '学校设置', desc: '学校信息和组织结构' },
  { href: '/admin/ai-config', icon: '🤖', title: 'AI 配置', desc: '大模型和用量管理' },
  { href: '/admin/plugins', icon: '🧩', title: '插件管理', desc: '安装和配置插件' },
  { href: '/admin/monitor', icon: '📈', title: '系统监控', desc: '查看系统运行状态' },
  { href: '/admin/settings', icon: '⚙️', title: '系统设置', desc: '全局参数配置' },
];

export default function AdminPage() {
  const [stats, setStats] = useState<any>(null);
  const [plugins, setPlugins] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/api/admin/stats').then(setStats).catch(() => {});
    apiFetch('/api/plugins').then(setPlugins).catch(() => {});
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">系统概览</h1>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="总用户" value={stats.userCount} />
          <StatCard label="教师" value={stats.teacherCount} />
          <StatCard label="学生" value={stats.studentCount} />
          <StatCard label="班级" value={stats.classCount} />
        </div>
      )}

      {/* 功能入口 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <Link key={c.href} href={c.href}
            className="bg-gray-800 rounded-xl p-5 hover:bg-gray-700 transition border border-gray-700 block">
            <h3 className="font-bold mb-1">{c.icon} {c.title}</h3>
            <p className="text-sm text-gray-400">{c.desc}</p>
          </Link>
        ))}
      </div>

      {/* 已加载插件 */}
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h2 className="text-lg font-bold mb-4">已加载插件</h2>
        {plugins.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无加载的插件</p>
        ) : (
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
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
