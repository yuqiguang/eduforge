'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

type ClassItem = {
  id: string;
  name: string;
  academicYear: string;
  createdAt: string;
  grade?: { name: string };
  students?: { studentId: string }[];
  teachers?: { subject: { name: string }; teacher: { user: { name: string } } }[];
};

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [grades, setGrades] = useState<any[]>([]);

  async function loadClasses() {
    setLoading(true);
    try {
      const data = await apiFetch('/api/classes');
      setClasses(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadClasses();
    apiFetch('/api/grades').then(setGrades).catch(() => {});
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">班级管理</h1>
          <p className="text-gray-500 text-sm mt-1">管理你的班级和学生</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          + 创建班级
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">加载中...</div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-4xl mb-3">👥</div>
          <h3 className="text-lg font-medium text-gray-600 mb-2">还没有班级</h3>
          <p className="text-gray-400">点击"创建班级"开始</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map(c => (
            <div key={c.id} className="bg-white rounded-xl border p-5 hover:shadow-sm transition">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 text-lg">{c.name}</h3>
                <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-600">{c.academicYear}</span>
              </div>
              {c.grade && <p className="text-sm text-gray-500 mb-2">📚 {c.grade.name}</p>}
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>🎓 {c.students?.length || 0} 名学生</span>
                <span>📅 {new Date(c.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
              {c.teachers && c.teachers.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-400 mb-1">任课教师</p>
                  <div className="flex flex-wrap gap-1">
                    {c.teachers.map((t, i) => (
                      <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {t.teacher.user.name}({t.subject.name})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateClassModal grades={grades} onClose={() => setShowCreate(false)} onCreated={loadClasses} />
      )}
    </div>
  );
}

function CreateClassModal({ grades, onClose, onCreated }: { grades: any[]; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [gradeId, setGradeId] = useState('');
  const [academicYear, setAcademicYear] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiFetch('/api/classes', {
        method: 'POST',
        body: JSON.stringify({ name, gradeId, academicYear }),
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
      <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-4">创建班级</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">班级名称</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="w-full px-3 py-2 border rounded-lg" placeholder="如: 三年级1班" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">年级</label>
            <select value={gradeId} onChange={e => setGradeId(e.target.value)} required
              className="w-full px-3 py-2 border rounded-lg">
              <option value="">请选择年级</option>
              {grades.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">学年</label>
            <input value={academicYear} onChange={e => setAcademicYear(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg" placeholder="2025" />
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-gray-600">取消</button>
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50">
              {loading ? '创建中...' : '创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
