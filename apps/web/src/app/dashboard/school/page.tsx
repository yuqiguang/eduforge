'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface School {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
}

interface Member {
  id: string;
  name: string;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
}

export default function SchoolPage() {
  const router = useRouter();
  const [school, setSchool] = useState<School | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) { router.push('/login'); return; }
    const user = JSON.parse(stored);
    if (user.role !== 'ADMIN' || !user.schoolId) {
      router.push('/dashboard');
      return;
    }
    loadData(user.schoolId);
  }, [router]);

  async function loadData(schoolId: string) {
    try {
      const [schoolData, membersData] = await Promise.all([
        apiFetch(`/api/schools/${schoolId}`),
        apiFetch(`/api/schools/${schoolId}/members`),
      ]);
      setSchool(schoolData);
      setMembers(membersData);
      setForm({
        name: schoolData.name || '',
        address: schoolData.address || '',
        phone: schoolData.phone || '',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!school) return;
    setSaving(true);
    setError('');
    try {
      const updated = await apiFetch(`/api/schools/${school.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSchool(updated);
      setEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const roleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN': return '管理员';
      case 'TEACHER': return '教师';
      case 'STUDENT': return '学生';
      default: return role;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>;
  }

  if (!school) {
    return <div className="text-center text-gray-500 mt-10">未找到学校信息</div>;
  }

  const teachers = members.filter(m => m.role === 'TEACHER');
  const students = members.filter(m => m.role === 'STUDENT');
  const admins = members.filter(m => m.role === 'ADMIN');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">学校管理</h1>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* 学校信息卡片 */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">学校信息</h2>
          {!editing && (
            <button onClick={() => setEditing(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              编辑
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学校名称</label>
              <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">地址</label>
              <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="选填" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
              <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="选填" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm">
                {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={() => { setEditing(false); setForm({ name: school.name, address: school.address || '', phone: school.phone || '' }); }}
                className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 text-sm">
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-500">名称</span>
              <p className="font-medium">{school.name}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">学校编码</span>
              <p className="font-medium font-mono">{school.code}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">地址</span>
              <p className="font-medium">{school.address || '未填写'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500">电话</span>
              <p className="font-medium">{school.phone || '未填写'}</p>
            </div>
          </div>
        )}
      </div>

      {/* 成员列表 */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold mb-4">成员列表 ({members.length})</h2>

        {/* 管理员 */}
        {admins.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">管理员 ({admins.length})</h3>
            <MemberTable members={admins} roleLabel={roleLabel} />
          </div>
        )}

        {/* 教师 */}
        {teachers.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">教师 ({teachers.length})</h3>
            <MemberTable members={teachers} roleLabel={roleLabel} />
          </div>
        )}

        {/* 学生 */}
        {students.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">学生 ({students.length})</h3>
            <MemberTable members={students} roleLabel={roleLabel} />
          </div>
        )}

        {members.length === 0 && (
          <p className="text-center text-gray-400 py-8">暂无成员</p>
        )}
      </div>
    </div>
  );
}

function MemberTable({ members, roleLabel }: { members: Member[]; roleLabel: (r: string) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b">
            <th className="pb-2 font-medium">姓名</th>
            <th className="pb-2 font-medium">邮箱</th>
            <th className="pb-2 font-medium">角色</th>
            <th className="pb-2 font-medium">状态</th>
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.id} className="border-b last:border-0">
              <td className="py-2">{m.name}</td>
              <td className="py-2 text-gray-500">{m.email || '-'}</td>
              <td className="py-2">
                <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">{roleLabel(m.role)}</span>
              </td>
              <td className="py-2">
                <span className={`px-2 py-0.5 rounded-full text-xs ${m.status === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                  {m.status === 'ACTIVE' ? '正常' : '禁用'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
