'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type MistakeRecord = {
  assignment_title: string;
  subject_id: string;
  details: any;
  feedback: string;
  answers: any;
  graded_at: string;
};

export default function MistakesPage() {
  const [records, setRecords] = useState<MistakeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/api/subjects').then(setSubjects).catch(() => {});
    loadMistakes();
  }, []);

  useEffect(() => {
    loadMistakes();
  }, [subjectFilter]);

  async function loadMistakes() {
    setLoading(true);
    try {
      const query = subjectFilter ? `?subjectId=${subjectFilter}` : '';
      const data = await apiFetch(`/api/plugins/ai-grading/mistakes${query}`);
      setRecords(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }

  // Extract wrong questions from grading details
  const mistakes: { question: string; myAnswer: string; correctAnswer: string; comment: string; assignmentTitle: string; subjectId: string; gradedAt: string }[] = [];
  for (const r of records) {
    const details = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || []);
    const answers = typeof r.answers === 'string' ? JSON.parse(r.answers) : (r.answers || {});
    for (const d of details) {
      if (d.correct === false) {
        mistakes.push({
          question: d.questionId || '未知题目',
          myAnswer: answers[d.questionId] || '未作答',
          correctAnswer: d.correctAnswer || '--',
          comment: d.comment || '',
          assignmentTitle: r.assignment_title,
          subjectId: r.subject_id,
          gradedAt: r.graded_at,
        });
      }
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">错题本</h1>
      <p className="text-gray-500 text-sm mb-6">回顾做错的题目，查看 AI 解析</p>

      <div className="flex gap-2 mb-6">
        <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          <option value="">全部学科</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : mistakes.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-4xl mb-3">✨</div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">没有错题</h3>
          <p className="text-gray-400">{records.length === 0 ? '还没有批改记录' : '太棒了，全部答对！'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {mistakes.map((m, i) => (
            <div key={i} className="bg-white rounded-xl border p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400">来自: {m.assignmentTitle}</span>
                <span className="text-xs text-gray-400">{new Date(m.gradedAt).toLocaleDateString('zh-CN')}</span>
              </div>
              <p className="font-medium text-gray-800 mb-3">题目 ID: {m.question}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-xs text-red-500 mb-1">❌ 我的答案</p>
                  <p className="text-sm text-red-700">{m.myAnswer}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-green-500 mb-1">✅ 正确答案</p>
                  <p className="text-sm text-green-700">{m.correctAnswer}</p>
                </div>
              </div>
              {m.comment && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-blue-500 mb-1">🤖 AI 解析</p>
                  <p className="text-sm text-blue-700">{m.comment}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
