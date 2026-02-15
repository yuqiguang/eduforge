'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface Plugin {
  name: string;
  version: string;
  displayName: string | null;
  description: string | null;
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/plugins').then(setPlugins).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-center mt-20">加载中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">插件管理</h1>
        <span className="text-sm text-gray-400">已加载 {plugins.length} 个插件</span>
      </div>

      {plugins.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-500">
          暂无加载的插件
        </div>
      ) : (
        <div className="space-y-3">
          {plugins.map(p => (
            <div key={p.name} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold">{p.displayName || p.name}</h3>
                  <p className="text-sm text-gray-400 mt-1">{p.description || '无描述'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">v{p.version}</span>
                  <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded-full">运行中</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-700 flex gap-2">
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">名称: {p.name}</span>
                <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">版本: {p.version}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
