'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

const PROVIDERS = [
  { id: 'qwen', name: '通义千问', models: ['qwen-turbo', 'qwen-plus', 'qwen-max'] },
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder'] },
  { id: 'openai', name: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o'] },
  { id: 'doubao', name: '豆包（字节）', models: ['doubao-pro-4k', 'doubao-pro-32k'] },
  { id: 'ollama', name: 'Ollama（本地）', models: ['qwen2.5:7b', 'llama3.1:8b'] },
];

export default function AISettingsPage() {
  const [provider, setProvider] = useState('qwen');
  const [model, setModel] = useState('qwen-turbo');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const selectedProvider = PROVIDERS.find(p => p.id === provider);

  async function handleSave() {
    setSaving(true);
    try {
      await apiFetch('/api/ai/config', {
        method: 'POST',
        body: JSON.stringify({ provider, model, apiKey, baseUrl: baseUrl || undefined, isDefault: true }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.message);
    }
    setSaving(false);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult('');
    try {
      // 通过健康检查验证连接（简化版，实际应调用 AI 接口测试）
      await apiFetch('/api/health');
      setTestResult('✅ 服务连接正常');
    } catch {
      setTestResult('❌ 连接失败');
    }
    setTesting(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">AI 设置</h1>
      <p className="text-gray-500 text-sm mb-8">配置 AI 大模型，用于智能批改和出题</p>

      <div className="max-w-2xl space-y-6">
        {/* 提供商选择 */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-bold mb-4">AI 提供商</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => { setProvider(p.id); setModel(p.models[0]); }}
                className={`p-3 rounded-lg border-2 text-left transition ${provider === p.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="font-medium text-sm">{p.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{p.models.length} 个模型</div>
              </button>
            ))}
          </div>
        </div>

        {/* 模型和密钥 */}
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="font-bold">模型配置</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">模型</label>
            <select value={model} onChange={e => setModel(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              {selectedProvider?.models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <div className="relative">
              <input type={showKey ? 'text' : 'password'} value={apiKey} onChange={e => setApiKey(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg pr-16" placeholder="sk-..." />
              <button type="button" onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600">
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          {provider === 'ollama' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
              <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" placeholder="http://localhost:11434/v1" />
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleTest} disabled={testing}
              className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50">
              {testing ? '测试中...' : '测试连接'}
            </button>
            <button onClick={handleSave} disabled={saving || !apiKey}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {saving ? '保存中...' : saved ? '✅ 已保存' : '保存配置'}
            </button>
          </div>

          {testResult && <p className="text-sm">{testResult}</p>}
        </div>

        {/* 使用说明 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">💡 推荐配置</p>
          <ul className="list-disc ml-4 space-y-1 text-amber-700">
            <li>国内推荐 <b>通义千问</b> 或 <b>DeepSeek</b>，性价比高</li>
            <li>本地部署推荐 <b>Ollama</b>，无需 API Key，数据完全本地</li>
            <li>API Key 加密存储在服务器，不会泄露</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
