'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface HealthData {
  status: string;
  version: string;
  timestamp: string;
}

export default function MonitorPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/health').catch(() => null),
      apiFetch('/api/admin/stats').catch(() => null),
      apiFetch('/api/plugins').catch(() => []),
    ]).then(([h, s, p]) => {
      setHealth(h);
      setStats(s);
      setPlugins(p || []);
    }).finally(() => setLoading(false));
  }, []);

  function refresh() {
    setLoading(true);
    Promise.all([
      apiFetch('/api/health').catch(() => null),
      apiFetch('/api/admin/stats').catch(() => null),
      apiFetch('/api/plugins').catch(() => []),
    ]).then(([h, s, p]) => {
      setHealth(h);
      setStats(s);
      setPlugins(p || []);
    }).finally(() => setLoading(false));
  }

  if (loading) return <div className="text-gray-400 text-center mt-20">加载中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">系统监控</h1>
        <button onClick={refresh} className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600">刷新</button>
      </div>

      {/* 服务状态 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4">服务状态</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">API 服务</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${health?.status === 'ok' ? 'bg-green-400' : 'bg-red-400'}`} />
              <span className="font-medium">{health?.status === 'ok' ? '正常运行' : '异常'}</span>
            </div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">系统版本</p>
            <p className="font-medium mt-1">{health?.version || '-'}</p>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-400">服务器时间</p>
            <p className="font-medium mt-1">
              {health?.timestamp ? new Date(health.timestamp).toLocaleString('zh-CN') : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* 数据统计 */}
      {stats && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold mb-4">数据统计</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatItem label="用户总数" value={stats.userCount} />
            <StatItem label="教师" value={stats.teacherCount} />
            <StatItem label="学生" value={stats.studentCount} />
            <StatItem label="班级" value={stats.classCount} />
          </div>
        </div>
      )}

      {/* 插件状态 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        <h2 className="text-lg font-semibold mb-4">插件状态 ({plugins.length})</h2>
        {plugins.length === 0 ? (
          <p className="text-gray-500 text-sm">暂无插件</p>
        ) : (
          <div className="space-y-2">
            {plugins.map((p: any) => (
              <div key={p.name} className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-3">
                <span className="font-medium">{p.displayName || p.name} <span className="text-xs text-gray-400">v{p.version}</span></span>
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-700 rounded-lg p-3">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  );
}
