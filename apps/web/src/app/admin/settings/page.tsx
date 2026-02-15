'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface SettingItem {
  key: string;
  value: string;
  label: string;
  type: 'text' | 'toggle';
}

const settingDefs: Omit<SettingItem, 'value'>[] = [
  { key: 'site_name', label: '站点名称', type: 'text' },
  { key: 'allow_registration', label: '允许注册', type: 'toggle' },
  { key: 'allow_ai_chat', label: '允许 AI 对话', type: 'toggle' },
  { key: 'max_ai_tokens_per_day', label: '每日 AI Token 上限', type: 'text' },
  { key: 'announcement', label: '系统公告', type: 'text' },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/settings').then(setSettings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function updateSetting(key: string, value: any) {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch('/api/admin/settings', { method: 'PUT', body: JSON.stringify(settings) });
      setSaved(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-center mt-20">加载中...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">系统设置</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-400">已保存</span>}
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 divide-y divide-gray-700">
        {settingDefs.map(def => (
          <div key={def.key} className="px-6 py-4 flex items-center justify-between">
            <label className="text-sm font-medium">{def.label}</label>
            {def.type === 'toggle' ? (
              <button
                onClick={() => updateSetting(def.key, settings[def.key] === true ? false : true)}
                className={`relative w-11 h-6 rounded-full transition ${settings[def.key] === true ? 'bg-blue-600' : 'bg-gray-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${settings[def.key] === true ? 'translate-x-5' : ''}`} />
              </button>
            ) : (
              <input
                value={settings[def.key] ?? ''}
                onChange={e => updateSetting(def.key, e.target.value)}
                className="px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg text-sm text-white w-60 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="未设置"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
