'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type Assignment = {
  id: string;
  title: string;
  description: string;
  class_id: string;
  subject_id: string;
  question_ids: string[];
  deadline: string;
  status: string;
  created_at: string;
};

type Submission = {
  id: string;
  student_name?: string;
  status: string;
  score: number | null;
  submitted_at: string;
};

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);

  async function loadAssignments() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/plugins/homework/assignments');
      setAssignments(Array.isArray(data) ? data : []);
    } catch { }
    setLoading(false);
  }

  useEffect(() => { loadAssignments(); }, []);

  if (viewingId) {
    const a = assignments.find(x => x.id === viewingId);
    return <SubmissionsView assignment={a!} onBack={() => setViewingId(null)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">作业管理</h1>
          <p className="text-gray-500 text-sm mt-1">布置和管理作业</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + 布置作业
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : assignments.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">还没有布置作业</h3>
          <p className="text-gray-400">点击"布置作业"开始</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => (
            <div key={a.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition cursor-pointer" onClick={() => setViewingId(a.id)}>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-800">{a.title}</h3>
                  {a.description && <p className="text-sm text-gray-500 mt-1">{a.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>📝 {a.question_ids?.length || 0} 道题</span>
                    {a.deadline && <span>⏰ 截止: {new Date(a.deadline).toLocaleString('zh-CN')}</span>}
                    <span>📅 {new Date(a.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${a.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'}`}>
                    {a.status === 'ACTIVE' ? '进行中' : a.status}
                  </span>
                  <span className="text-gray-300 text-sm">›</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateAssignmentModal onClose={() => setShowCreate(false)} onCreated={loadAssignments} />}
    </div>
  );
}

function SubmissionsView({ assignment, onBack }: { assignment: Assignment; onBack: () => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/plugins/homework/submissions?assignmentId=${assignment.id}`)
      .then(data => setSubmissions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assignment.id]);

  return (
    <div>
      <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-4">← 返回作业列表</button>
      <h1 className="text-2xl font-bold mb-1">{assignment.title}</h1>
      <p className="text-gray-500 text-sm mb-6">
        {assignment.question_ids?.length || 0} 道题 · 
        {assignment.deadline ? ` 截止: ${new Date(assignment.deadline).toLocaleString('zh-CN')}` : ' 无截止时间'}
      </p>

      <div className="bg-white rounded-xl border">
        <div className="px-5 py-3 border-b">
          <h2 className="font-medium">提交情况 ({submissions.length} 份)</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : submissions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">暂无提交</div>
        ) : (
          <div className="divide-y">
            {submissions.map(s => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-800">{s.student_name || '学生'}</span>
                  <span className="text-xs text-gray-400 ml-3">{new Date(s.submitted_at).toLocaleString('zh-CN')}</span>
                </div>
                <div className="flex items-center gap-2">
                  {s.score !== null && s.score !== undefined && (
                    <span className="text-sm font-bold text-blue-600">{s.score}分</span>
                  )}
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    s.status === 'GRADED' ? 'bg-green-50 text-green-600' :
                    s.status === 'SUBMITTED' ? 'bg-yellow-50 text-yellow-600' :
                    'bg-gray-50 text-gray-500'
                  }`}>
                    {s.status === 'GRADED' ? '已批改' : s.status === 'SUBMITTED' ? '待批改' : s.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateAssignmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/api/plugins/question-bank/questions?pageSize=100')
      .then(data => setQuestions(data.data || []))
      .catch(() => {});
    apiFetch('/api/classes').then(data => setClasses(Array.isArray(data) ? data : [])).catch(() => {});
    apiFetch('/api/subjects').then(data => setSubjects(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const filteredQuestions = subjectFilter
    ? questions.filter(q => q.subject_id === subjectFilter || q.subjectId === subjectFilter)
    : questions;

  function toggleQuestion(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) { alert('请至少选择一道题目'); return; }
    setLoading(true);
    try {
      await apiFetch('/api/plugins/homework/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title, description,
          classId: classId || 'default',
          subjectId: subjectFilter || 'general',
          questionIds: selected,
          deadline: deadline || undefined,
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
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">布置作业</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">作业标题</label>
            <input value={title} onChange={e => setTitle(e.target.value)} required
              className="w-full px-3 py-2 border rounded-lg" placeholder="如: 第三章练习" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2 border rounded-lg" placeholder="作业要求..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">选择班级</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg bg-white">
                <option value="">全部班级</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">截止时间（可选）</label>
              <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">选择题目 (已选 {selected.length} 道)</label>
              <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
                className="text-sm px-2 py-1 border rounded-lg bg-white">
                <option value="">全部学科</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="border rounded-lg max-h-60 overflow-y-auto">
              {filteredQuestions.length === 0 ? (
                <p className="p-4 text-center text-gray-400">
                  {questions.length === 0 ? '题库为空，请先添加题目' : '该学科下没有题目'}
                </p>
              ) : filteredQuestions.map(q => (
                <div key={q.id} onClick={() => toggleQuestion(q.id)}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 ${selected.includes(q.id) ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={selected.includes(q.id)} readOnly className="rounded" />
                    <span className="text-sm flex-1">{q.content}</span>
                    <span className="text-xs text-gray-400">{q.type === 'CHOICE' ? '选择题' : q.type === 'FILL' ? '填空题' : '问答题'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600">取消</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {loading ? '创建中...' : '布置作业'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
