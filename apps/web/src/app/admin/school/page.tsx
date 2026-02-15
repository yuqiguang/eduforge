'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface School {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
}

export default function SchoolSettingsPage() {
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', address: '', phone: '' });

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (!stored) return;
    const user = JSON.parse(stored);
    if (!user.schoolId) { setLoading(false); return; }
    apiFetch(`/api/schools/${user.schoolId}`)
      .then(data => {
        setSchool(data);
        setForm({ name: data.name || '', address: data.address || '', phone: data.phone || '' });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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

  if (loading) return <div className="text-gray-400 text-center mt-20">加载中...</div>;

  if (!school) return <div className="text-gray-500 text-center mt-20">未关联学校</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">学校设置</h1>

      {error && <div className="bg-red-900/50 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">学校名称</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">地址</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="选填" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">电话</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="选填" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? '保存中...' : '保存'}
              </button>
              <button onClick={() => { setEditing(false); setForm({ name: school.name, address: school.address || '', phone: school.phone || '' }); }}
                className="px-4 py-2 bg-gray-700 rounded-lg text-sm text-gray-300 hover:bg-gray-600">取消</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">学校信息</h2>
              <button onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm bg-blue-600 rounded-lg hover:bg-blue-700">编辑</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InfoItem label="名称" value={school.name} />
              <InfoItem label="学校编码" value={school.code} mono />
              <InfoItem label="地址" value={school.address || '未填写'} />
              <InfoItem label="电话" value={school.phone || '未填写'} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-sm text-gray-400">{label}</span>
      <p className={`font-medium mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
