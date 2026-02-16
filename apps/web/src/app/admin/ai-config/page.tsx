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
  schoolId: string | null;
}

const PROVIDERS = [
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'qwen', name: '通义千问', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'] },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o'] },
  { id: 'zhipu', name: '智谱 AI', models: ['glm-4', 'glm-4-flash'] },
  { id: 'doubao', name: '豆包（字节）', models: ['doubao-pro-4k', 'doubao-pro-32k'] },
  { id: 'ollama', name: 'Ollama（本地）', models: ['qwen2.5:7b', 'llama3.1:8b'] },
];

export default function AIConfigPage() {
  const [configs, setConfigs] = useState<AIConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ provider: 'deepseek', model: 'deepseek-chat', apiKey: '', baseUrl: '' });
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
    apiFetch('/api/ai/config').then(setConfigs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const selectedProvider = PROVIDERS.find(p => p.id === form.provider);

  async function handleAdd() {
    setSaving(true);
    setError('');
    try {
      const body: any = {
        provider: form.provider,
        model: form.model,
        apiKey: form.apiKey,
        isDefault: true,
        schoolId: user?.schoolId || undefined,
      };
      if (form.baseUrl) body.baseUrl = form.baseUrl;
      const created = await apiFetch('/api/ai/config', { method: 'POST', body: JSON.stringify(body) });
      setConfigs(prev => [...prev, created]);
      setShowAdd(false);
      setForm({ provider: 'deepseek', model: 'deepseek-chat', apiKey: '', baseUrl: '' });
      setTestResult(null);
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
      const body: any = {
        provider: form.provider,
        model: form.model,
        apiKey: form.apiKey,
      };
      if (form.baseUrl) body.baseUrl = form.baseUrl;
      const result = await apiFetch('/api/ai/test', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (result.success) {
        setTestResult({ success: true, message: `连接成功 | 模型: ${result.model} | 响应: ${result.responseTime}ms` });
      } else {
        setTestResult({ success: false, message: result.error || '连接失败' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiFetch(`/api/ai/config/${id}`, { method: 'DELETE' });
      setConfigs(prev => prev.filter(c => c.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (loading) return <div className="text-gray-400 text-center mt-20">加载中...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AI 配置</h1>
          <p className="text-sm text-gray-400 mt-1">配置 AI 大模型，用于智能对话、批改和出题</p>
        </div>
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

          {/* Provider 选择 */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">选择 AI 提供商</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PROVIDERS.map(p => (
                <button key={p.id} onClick={() => { setForm({ ...form, provider: p.id, model: p.models[0] }); }}
                  className={`p-3 rounded-lg border text-left text-sm transition ${form.provider === p.id ? 'border-blue-500 bg-blue-900/30 text-blue-300' : 'border-gray-600 text-gray-400 hover:border-gray-500'}`}>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.models.length} 个模型</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">模型</label>
              <select value={form.model} onChange={e => setForm({ ...form, model: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                {selectedProvider?.models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">API Key</label>
              <input type="password" value={form.apiKey} onChange={e => setForm({ ...form, apiKey: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" placeholder="sk-..." />
            </div>
          </div>

          {(form.provider === 'ollama' || form.baseUrl) && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Base URL {form.provider !== 'ollama' && '(选填)'}</label>
              <input value={form.baseUrl} onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                placeholder={form.provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.deepseek.com'} />
            </div>
          )}

          {testResult && (
            <div className={`px-4 py-3 rounded-lg text-sm ${testResult.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
              {testResult.success ? '✅' : '❌'} {testResult.message}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleTest} disabled={testing}
              className="px-4 py-2 bg-gray-700 rounded-lg text-sm hover:bg-gray-600 disabled:opacity-50">
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button onClick={handleAdd} disabled={saving || !form.apiKey}
              className="px-4 py-2 bg-blue-600 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
              {saving ? '保存中...' : '保存配置'}
            </button>
          </div>

          {/* 使用说明 */}
          <div className="bg-gray-700/50 rounded-lg p-4 text-sm text-gray-400">
            <p className="font-medium text-gray-300 mb-1">💡 提示</p>
            <ul className="list-disc ml-4 space-y-1">
              <li>国内推荐 <b className="text-gray-300">DeepSeek</b> 或 <b className="text-gray-300">通义千问</b>，性价比高</li>
              <li>本地部署推荐 <b className="text-gray-300">Ollama</b>，数据完全本地化</li>
              <li>保存后所有用户（教师/学生）的 AI 对话都将使用此配置</li>
            </ul>
          </div>
        </div>
      )}

      {/* 已有配置 */}
      <div className="space-y-3">
        {configs.length === 0 ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
            <p className="text-gray-400 mb-2">暂无 AI 配置</p>
            <p className="text-sm text-gray-500">点击"添加配置"来设置 AI 模型，配置后用户即可使用 AI 对话功能</p>
          </div>
        ) : configs.map(c => (
          <div key={c.id} className="bg-gray-800 rounded-xl border border-gray-700 p-5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold">{PROVIDERS.find(p => p.id === c.provider)?.name || c.provider}</span>
                <span className="ml-2 text-sm text-gray-400">{c.model}</span>
                <span className="ml-3 text-xs text-gray-500">Key: {c.apiKey}</span>
                {c.baseUrl && <span className="ml-2 text-xs text-gray-500">| {c.baseUrl}</span>}
              </div>
              <div className="flex items-center gap-2">
                {c.isDefault && <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded">默认</span>}
                <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded">已启用</span>
                <button onClick={() => handleDelete(c.id)}
                  className="text-xs text-gray-500 hover:text-red-400 ml-2 transition">删除</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
