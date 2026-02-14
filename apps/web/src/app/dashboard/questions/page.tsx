'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type Question = {
  id: string;
  type: string;
  content: string;
  options: any;
  answer: string;
  explanation: string;
  difficulty: number;
  subject_id: string;
  created_at: string;
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAI, setShowAI] = useState(false);

  async function loadQuestions() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/plugins/question-bank/questions');
      setQuestions(data.data || []);
      setTotal(data.total || 0);
    } catch { }
    setLoading(false);
  }

  useEffect(() => { loadQuestions(); }, []);

  const typeLabels: Record<string, string> = {
    SINGLE_CHOICE: '单选', MULTI_CHOICE: '多选', TRUE_FALSE: '判断',
    FILL_BLANK: '填空', SHORT_ANSWER: '简答', ESSAY: '作文',
  };

  const difficultyLabel = (d: number) => d <= 0.3 ? '简单' : d <= 0.6 ? '中等' : '困难';
  const difficultyColor = (d: number) => d <= 0.3 ? 'text-green-600 bg-green-50' : d <= 0.6 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">题库管理</h1>
          <p className="text-gray-500 text-sm mt-1">共 {total} 道题目</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAI(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
            🤖 AI 出题
          </button>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
            + 手动添加
          </button>
        </div>
      </div>

      {/* 题目列表 */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : questions.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-4xl mb-3">📚</div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">题库还是空的</h3>
          <p className="text-gray-400 mb-4">点击"AI 出题"让 AI 帮你快速生成题目</p>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">{typeLabels[q.type] || q.type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${difficultyColor(q.difficulty)}`}>{difficultyLabel(q.difficulty)}</span>
                  </div>
                  <p className="text-gray-800">{q.content}</p>
                  {q.options && Array.isArray(q.options) && (
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt: any, idx: number) => (
                        <div key={idx} className={`text-sm ${opt.label === q.answer ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                          {opt.label}. {opt.content}
                          {opt.label === q.answer && ' ✓'}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.explanation && <p className="mt-2 text-sm text-gray-400">解析：{q.explanation}</p>}
                </div>
                <button onClick={async () => {
                  if (confirm('确定删除？')) {
                    await apiFetch(`/api/plugins/question-bank/questions/${q.id}`, { method: 'DELETE' });
                    loadQuestions();
                  }
                }} className="text-gray-300 hover:text-red-500 ml-3">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 手动创建弹窗 */}
      {showCreate && <CreateQuestionModal onClose={() => setShowCreate(false)} onCreated={loadQuestions} />}

      {/* AI 出题弹窗 */}
      {showAI && <AIGenerateModal onClose={() => setShowAI(false)} onCreated={loadQuestions} />}
    </div>
  );
}

function CreateQuestionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState('SINGLE_CHOICE');
  const [content, setContent] = useState('');
  const [answer, setAnswer] = useState('');
  const [explanation, setExplanation] = useState('');
  const [difficulty, setDifficulty] = useState(0.5);
  const [options, setOptions] = useState([
    { label: 'A', content: '' }, { label: 'B', content: '' },
    { label: 'C', content: '' }, { label: 'D', content: '' },
  ]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/plugins/question-bank/questions', {
        method: 'POST',
        body: JSON.stringify({
          type, content, answer, explanation, difficulty,
          options: type.includes('CHOICE') ? options : undefined,
          subjectId: 'math',
        }),
      });
      onCreated();
      onClose();
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">添加题目</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">题型</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
              <option value="SINGLE_CHOICE">单选题</option>
              <option value="MULTI_CHOICE">多选题</option>
              <option value="TRUE_FALSE">判断题</option>
              <option value="FILL_BLANK">填空题</option>
              <option value="SHORT_ANSWER">简答题</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">题干</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} required rows={3}
              className="w-full px-3 py-2 border rounded-lg" placeholder="输入题目内容..." />
          </div>
          {type.includes('CHOICE') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选项</label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium w-6">{opt.label}.</span>
                  <input value={opt.content} onChange={e => {
                    const newOpts = [...options];
                    newOpts[i].content = e.target.value;
                    setOptions(newOpts);
                  }} className="flex-1 px-3 py-1.5 border rounded-lg text-sm" placeholder={`选项 ${opt.label}`} />
                </div>
              ))}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">答案</label>
            <input value={answer} onChange={e => setAnswer(e.target.value)} required
              className="w-full px-3 py-2 border rounded-lg" placeholder="如 A、B 或具体答案" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">解析</label>
            <textarea value={explanation} onChange={e => setExplanation(e.target.value)} rows={2}
              className="w-full px-3 py-2 border rounded-lg" placeholder="答案解析（可选）" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">难度: {difficulty}</label>
            <input type="range" min="0" max="1" step="0.1" value={difficulty}
              onChange={e => setDifficulty(parseFloat(e.target.value))} className="w-full" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600">取消</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {loading ? '创建中...' : '创建题目'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AIGenerateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [knowledgePoint, setKnowledgePoint] = useState('');
  const [type, setType] = useState('选择题');
  const [count, setCount] = useState(3);
  const [difficulty, setDifficulty] = useState('中等');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function handleGenerate() {
    if (!knowledgePoint) return;
    setLoading(true);
    setResult(null);
    try {
      const data = await apiFetch('/api/plugins/question-bank/questions/ai-generate', {
        method: 'POST',
        body: JSON.stringify({ knowledgePoint, type, count, difficulty, subjectId: 'math' }),
      });
      setResult(data);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">🤖 AI 智能出题</h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">知识点</label>
            <input value={knowledgePoint} onChange={e => setKnowledgePoint(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" placeholder="如: 一元二次方程、现在完成时..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">题型</label>
              <select value={type} onChange={e => setType(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option>选择题</option><option>填空题</option><option>判断题</option><option>简答题</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">数量</label>
              <select value={count} onChange={e => setCount(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-lg">
                <option value={3}>3 道</option><option value={5}>5 道</option><option value={10}>10 道</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">难度</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="w-full px-3 py-2 border rounded-lg">
                <option>简单</option><option>中等</option><option>困难</option>
              </select>
            </div>
          </div>
          <button onClick={handleGenerate} disabled={loading || !knowledgePoint}
            className="w-full py-2.5 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50">
            {loading ? '🤖 AI 正在出题...' : '开始生成'}
          </button>
        </div>

        {result && (
          <div>
            <h3 className="font-medium mb-3">生成结果 {result.tokens && <span className="text-xs text-gray-400">（消耗 {result.tokens} tokens）</span>}</h3>
            {result.questions ? (
              <div className="space-y-3">
                {result.questions.map((q: any, i: number) => (
                  <div key={i} className="border rounded-lg p-3 text-sm">
                    <p className="font-medium">{i + 1}. {q.content}</p>
                    {q.options?.map((o: any, j: number) => (
                      <p key={j} className={`ml-4 ${o.label === q.answer ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                        {o.label}. {o.content}
                      </p>
                    ))}
                    <p className="text-gray-400 mt-1">答案: {q.answer} | {q.explanation}</p>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="bg-gray-50 rounded-lg p-3 text-sm overflow-auto max-h-60">{result.raw}</pre>
            )}
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600">关闭</button>
        </div>
      </div>
    </div>
  );
}
