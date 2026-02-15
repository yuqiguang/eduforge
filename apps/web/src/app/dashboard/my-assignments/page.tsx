'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type Assignment = {
  id: string;
  title: string;
  description: string;
  question_ids: string[];
  deadline: string;
  status: string;
  created_at: string;
  subject_id: string;
};

type Submission = {
  id: string;
  assignment_id: string;
  assignment_title: string;
  answers: any;
  score: number | null;
  status: string;
  submitted_at: string;
  feedback?: string;
  grading_details?: any;
  subject_id: string;
  deadline: string;
};

export default function MyAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [doingAssignment, setDoingAssignment] = useState<Assignment | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [assignData, subData] = await Promise.all([
        apiFetch('/api/plugins/homework/assignments'),
        apiFetch('/api/plugins/homework/my-submissions'),
      ]);
      setAssignments(Array.isArray(assignData) ? assignData : []);
      setSubmissions(Array.isArray(subData) ? subData : []);
    } catch (err: any) {
      setError(err.message || '加载失败');
    }
    setLoading(false);
  }

  const submittedIds = new Set(submissions.map(s => s.assignment_id));
  const pending = assignments.filter(a => !submittedIds.has(a.id) && a.status === 'ACTIVE');
  const completed = submissions;

  function statusLabel(s: Submission) {
    if (s.status === 'GRADED') return { text: `已批改 ${s.score !== null ? s.score + '分' : ''}`, cls: 'bg-green-50 text-green-600' };
    if (s.status === 'GRADING_FAILED') return { text: '批改失败', cls: 'bg-red-50 text-red-600' };
    return { text: '已提交，等待批改', cls: 'bg-yellow-50 text-yellow-600' };
  }

  if (loading) return <div className="text-center py-12 text-gray-400">加载中...</div>;

  if (error && !doingAssignment && !viewingSubmission) return (
    <div>
      <h1 className="text-2xl font-bold mb-1">我的作业</h1>
      <p className="text-gray-500 text-sm mb-6">查看和完成你的作业</p>
      <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>
    </div>
  );

  if (doingAssignment) {
    return <DoAssignment assignment={doingAssignment} onBack={() => { setDoingAssignment(null); loadData(); }} />;
  }

  if (viewingSubmission) {
    return <ViewGradingResult submission={viewingSubmission} onBack={() => setViewingSubmission(null)} />;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">我的作业</h1>
      <p className="text-gray-500 text-sm mb-6">查看和完成你的作业</p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>
          待完成 ({pending.length})
        </button>
        <button onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'completed' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>
          已完成 ({completed.length})
        </button>
      </div>

      {activeTab === 'pending' ? (
        pending.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <p className="text-gray-500">没有待完成的作业</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(a => (
              <div key={a.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-800">{a.title}</h3>
                    {a.description && <p className="text-sm text-gray-500 mt-1">{a.description}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>📝 {a.question_ids?.length || 0} 道题</span>
                      {a.deadline && <span className={`${new Date(a.deadline) < new Date() ? 'text-red-500' : ''}`}>⏰ 截止: {new Date(a.deadline).toLocaleString('zh-CN')}</span>}
                    </div>
                  </div>
                  <button onClick={() => setDoingAssignment(a)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    做作业
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        completed.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500">还没有完成的作业</p>
          </div>
        ) : (
          <div className="space-y-3">
            {completed.map(s => {
              const st = statusLabel(s);
              return (
                <div key={s.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition cursor-pointer"
                  onClick={() => s.status === 'GRADED' ? setViewingSubmission(s) : undefined}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-800">{s.assignment_title}</h3>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>📅 提交: {new Date(s.submitted_at).toLocaleString('zh-CN')}</span>
                        {s.score !== null && s.score !== undefined && (
                          <span className="text-blue-600 font-medium">🏆 {s.score}分</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${st.cls}`}>{st.text}</span>
                      {s.status === 'GRADED' && <span className="text-gray-300">›</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function ViewGradingResult({ submission, onBack }: { submission: Submission; onBack: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Load grading details
    apiFetch(`/api/plugins/homework/submissions/${submission.id}`)
      .then(data => {
        setDetails(data);
        // Try to load questions
        const qIds = data.question_ids || data.assignment?.question_ids || [];
        if (qIds.length > 0) {
          return apiFetch('/api/plugins/question-bank/questions?pageSize=100')
            .then(qData => {
              const all = qData.data || [];
              setQuestions(all.filter((q: any) => qIds.includes(q.id)));
            });
        }
      })
      .catch((err: any) => { setError(err.message || '加载失败'); })
      .finally(() => setLoading(false));
  }, [submission.id]);

  const answers = details?.answers || submission.answers || {};
  const gradingDetails = details?.grading_details || details?.gradingDetails || submission.grading_details || {};
  const feedback = details?.feedback || submission.feedback || '';
  let parsedAnswers: any = {};
  try {
    parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;
  } catch {
    parsedAnswers = {};
  }
  let parsedGrading: any = {};
  try {
    parsedGrading = typeof gradingDetails === 'string' ? JSON.parse(gradingDetails) : gradingDetails;
  } catch {
    parsedGrading = {};
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-4">← 返回作业列表</button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{submission.assignment_title}</h1>
          <p className="text-gray-500 text-sm mt-1">提交于 {new Date(submission.submitted_at).toLocaleString('zh-CN')}</p>
        </div>
        {submission.score !== null && (
          <div className="text-center">
            <div className={`text-4xl font-bold ${submission.score >= 80 ? 'text-green-600' : submission.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
              {submission.score}
            </div>
            <div className="text-xs text-gray-400">分数</div>
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      {/* AI 评语 */}
      {feedback && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">🤖</span>
            <span className="font-medium text-blue-800">AI 评语</span>
          </div>
          <p className="text-sm text-blue-700 leading-relaxed">{feedback}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">加载详情...</div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, i) => {
            const myAnswer = parsedAnswers[q.id] || '未作答';
            const qGrading = parsedGrading[q.id] || (Array.isArray(parsedGrading) ? parsedGrading[i] : null);
            const isCorrect = qGrading?.correct ?? qGrading?.isCorrect;

            return (
              <div key={q.id} className={`bg-white rounded-xl border p-5 ${isCorrect === true ? 'border-green-200' : isCorrect === false ? 'border-red-200' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <p className="font-medium text-gray-800">第 {i + 1} 题: {q.content}</p>
                  {isCorrect !== undefined && (
                    <span className={`text-sm px-2 py-0.5 rounded-full ${isCorrect ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {isCorrect ? '✓ 正确' : '✗ 错误'}
                    </span>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-500">你的答案：</span><span className="text-gray-800">{myAnswer}</span></p>
                  {qGrading?.correctAnswer && (
                    <p><span className="text-gray-500">正确答案：</span><span className="text-green-600 font-medium">{qGrading.correctAnswer}</span></p>
                  )}
                  {qGrading?.explanation && (
                    <p className="text-gray-500 mt-2 bg-gray-50 rounded-lg p-3 text-xs leading-relaxed">💡 {qGrading.explanation}</p>
                  )}
                </div>
              </div>
            );
          })}
          {questions.length === 0 && !loading && (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
              批改详情暂不可用
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DoAssignment({ assignment, onBack }: { assignment: Assignment; onBack: () => void }) {
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (assignment.question_ids?.length) {
      apiFetch(`/api/plugins/question-bank/questions?pageSize=100`)
        .then(data => {
          const all = data.data || [];
          const filtered = all.filter((q: any) => assignment.question_ids.includes(q.id));
          setQuestions(filtered);
        })
        .catch((err: any) => { setError(err.message || '加载失败'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [assignment]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await apiFetch('/api/plugins/homework/submissions', {
        method: 'POST',
        body: JSON.stringify({ assignmentId: assignment.id, answers }),
      });
      alert('提交成功！AI 正在批改中...');
      onBack();
    } catch (err: any) {
      alert(err.message);
    }
    setSubmitting(false);
  }

  if (loading) return <div className="text-center py-12 text-gray-400">加载题目中...</div>;

  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-4">← 返回作业列表</button>
      <h1 className="text-2xl font-bold mb-1">{assignment.title}</h1>
      {assignment.description && <p className="text-gray-500 text-sm mb-6">{assignment.description}</p>}

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      <div className="space-y-4 mb-6">
        {questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-xl border p-5">
            <p className="font-medium text-gray-800 mb-3">第 {i + 1} 题: {q.content}</p>
            {q.type === 'CHOICE' && q.options ? (
              <div className="space-y-2">
                {(() => { let opts: any[]; try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options; } catch { opts = []; } return opts; })().map((opt: any, j: number) => (
                  <label key={j} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${answers[q.id] === (opt.key || opt.label || String.fromCharCode(65 + j)) ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
                    <input type="radio" name={q.id} value={opt.key || opt.label || String.fromCharCode(65 + j)}
                      checked={answers[q.id] === (opt.key || opt.label || String.fromCharCode(65 + j))}
                      onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} />
                    <span className="text-sm">{opt.key || String.fromCharCode(65 + j)}. {opt.content || opt.text || opt}</span>
                  </label>
                ))}
              </div>
            ) : (
              <textarea value={answers[q.id] || ''} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg" rows={3} placeholder="请输入你的答案..." />
            )}
          </div>
        ))}
      </div>

      <button onClick={handleSubmit} disabled={submitting}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
        {submitting ? '提交中...' : '提交作业'}
      </button>
    </div>
  );
}
