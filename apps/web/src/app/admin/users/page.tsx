'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

const roleLabel: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  ADMIN: '管理员',
  TEACHER: '教师',
  STUDENT: '学生',
};

const statusLabel: Record<string, { text: string; cls: string }> = {
  ACTIVE: { text: '正常', cls: 'bg-green-900 text-green-300' },
  INACTIVE: { text: '未激活', cls: 'bg-gray-700 text-gray-300' },
  SUSPENDED: { text: '已禁用', cls: 'bg-red-900 text-red-300' },
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    apiFetch('/api/admin/users').then(setUsers).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function toggleStatus(user: User) {
    const newStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      const updated = await apiFetch(`/api/admin/users/${user.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, status: updated.status } : u));
    } catch (err: any) {
      alert(err.message);
    }
  }

  const filtered = filter === 'ALL' ? users : users.filter(u => u.role === filter);

  if (loading) return <div className="text-gray-400 text-center mt-20">加载中...</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">用户管理</h1>
        <span className="text-sm text-gray-400">共 {users.length} 人</span>
      </div>

      {/* 筛选 */}
      <div className="flex gap-2">
        {['ALL', 'ADMIN', 'TEACHER', 'STUDENT'].map(r => (
          <button key={r} onClick={() => setFilter(r)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filter === r ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {r === 'ALL' ? '全部' : roleLabel[r]}
          </button>
        ))}
      </div>

      {/* 用户表格 */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="px-4 py-3 font-medium">姓名</th>
                <th className="px-4 py-3 font-medium">邮箱</th>
                <th className="px-4 py-3 font-medium">角色</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">最后登录</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-gray-700 last:border-0">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-400">{u.email || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{roleLabel[u.role] || u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${statusLabel[u.status]?.cls || 'bg-gray-700'}`}>
                      {statusLabel[u.status]?.text || u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('zh-CN') : '从未登录'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleStatus(u)}
                      className={`text-xs px-2 py-1 rounded transition ${u.status === 'ACTIVE' ? 'bg-red-900/50 text-red-300 hover:bg-red-900' : 'bg-green-900/50 text-green-300 hover:bg-green-900'}`}>
                      {u.status === 'ACTIVE' ? '禁用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">暂无用户</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
