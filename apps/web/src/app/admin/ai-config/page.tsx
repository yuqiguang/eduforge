'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface AIConfig {
  id: string;
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string | null;
  isDefault: boolean;
}

export default function AIConfigPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ provider: 'deepseek', model: 'deepseek-chat', apiKey: '', baseUrl: '' });

  useEffect(() => {
    apiFetch('/api/ai/config').then(setConfigs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    setSaving(true);
    setError('');
    try {
      const body: any = { provider: form.provider, model: form.model, apiKey: form.apiKey };
      if (form.baseUrl) body.baseUrl = form.baseUrl;
      const created = await apiFetch('/api/ai/config', { method: 'POST', body: JSON.stringify(body) });
      setConfigs(prev => [...prev, created]);
      setShowAdd(false);
      setForm({ provider: 'deepseek', model: 'deepseek-chat', apiKey: '', baseUrl: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiFetch('/api/ai/test', {
        method: 'POST',
        body: JSON.stringify({ provider: form.provider, model: form.model, apiKey: form.apiKey, baseUrl: form.baseUrl || undefined }),
      });
      setTestResult(result.reply || '连接成功');
    } catch (err: any) {
      setTestResult('测试失败: ' + err.message);
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-center mt-20">加载中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI 配置</h1>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700">
          {showAdd ? '取消' : '添加配置'}
        </button>
      </div>

      {error && <div className="bg-red-900/50 text-red-300 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* 添加表单 */}
      {showAdd && (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 space-y-4">
          <h2 className="font-semibold">新增 AI 模型配置</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Provider</label>
              <select value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                <option value="deepseek">DeepSeek</option>
                <option value="qwen">通义千问</option>
                <option value="openai">OpenAI</option>
                <option value="zhipu">智谱 AI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">模型名称</label>
              <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" placeholder="deepseek-chat" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key</label>
              <input type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" placeholder="sk-..." />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Base URL (选填)</label>
              <input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" placeholder="https://api.deepseek.com" />
            </div>
          </div>
          {testResult && (
            <div className={`px-4 py-2 rounded-lg text-sm ${testResult.startsWith('测试失败') ? 'bg-red-900/50 text-red-300' : 'bg-green-900/50 text-green-300'}`}>
              {testResult}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleTest} disabled={testing || !form.apiKey}
              className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50">
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button onClick={handleAdd} disabled={saving || !form.apiKey}
              className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      {/* 已有配置 */}
      <div className="space-y-3">
        {configs.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-500">
            暂无 AI 配置，点击"添加配置"开始
          </div>
        ) : configs.map(c => (
          <div key={c.id} className="bg-gray-800 rounded-xl border border-gray-700 p-4 flex items-center justify-between">
            <div>
              <span className="font-medium">{c.provider}</span>
              <span className="ml-2 text-sm text-gray-400">{c.model}</span>
              <span className="ml-2 text-xs text-gray-500">Key: {c.apiKey}</span>
              {c.baseUrl && <span className="ml-2 text-xs text-gray-500">{c.baseUrl}</span>}
            </div>
            <div className="flex items-center gap-2">
              {c.isDefault && <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">默认</span>}
              <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded">已启用</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
