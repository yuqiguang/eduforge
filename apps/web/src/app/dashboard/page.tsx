'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [plugins, setPlugins] = useState<any[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));

    apiFetch('/api/plugins').then(setPlugins).catch(() => {});
  }, []);

  if (!user) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">欢迎回来，{user.name}</h1>
      <p className="text-gray-500 mb-8">这是你的教学工作台</p>

      {/* 快捷操作 */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="题库" value="--" icon="📚" color="blue" />
        <StatCard label="作业" value="--" icon="📋" color="green" />
        <StatCard label="班级" value="--" icon="👥" color="purple" />
        <StatCard label="学生" value="--" icon="🎓" color="orange" />
      </div>

      {/* 已加载插件 */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-bold mb-4">已加载插件</h2>
        {plugins.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plugins.map((p: any) => (
              <div key={p.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{p.displayName || p.name}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">v{p.version}</span>
                </div>
                <p className="text-sm text-gray-500">{p.description || '无描述'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">加载中...</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
