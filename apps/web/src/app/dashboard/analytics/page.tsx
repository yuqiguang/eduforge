'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

export default function AnalyticsPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/classes')
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setClasses(list);
        if (list.length > 0) setSelectedClass(list[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    Promise.all([
      apiFetch(`/api/plugins/homework/assignments?classId=${selectedClass}`),
      apiFetch(`/api/plugins/homework/submissions?assignmentId=`),
    ]).then(([a, s]) => {
      setAssignments(Array.isArray(a) ? a : []);
      setSubmissions(Array.isArray(s) ? s : []);
    }).catch(() => {});
  }, [selectedClass]);

  if (loading) return <div className="text-center py-12 text-gray-400">加载中...</div>;

  // Stats
  const classAssignments = assignments.filter(a => a.class_id === selectedClass);
  const classSubmissions = submissions.filter(s =>
    classAssignments.some(a => a.id === s.assignment_id)
  );
  const gradedSubs = classSubmissions.filter(s => s.status === 'GRADED');
  const avgScore = gradedSubs.length
    ? Math.round(gradedSubs.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / gradedSubs.length)
    : 0;

  // Student ranking
  const studentScores: Record<string, { total: number; count: number }> = {};
  for (const s of gradedSubs) {
    if (!studentScores[s.student_id]) studentScores[s.student_id] = { total: 0, count: 0 };
    studentScores[s.student_id].total += s.score || 0;
    studentScores[s.student_id].count++;
  }
  const ranking = Object.entries(studentScores)
    .map(([id, data]) => ({ id, avg: Math.round(data.total / data.count), count: data.count }))
    .sort((a, b) => b.avg - a.avg);

  const currentClass = classes.find(c => c.id === selectedClass);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">学情分析</h1>
      <p className="text-gray-500 text-sm mb-6">班级成绩概览和学生表现</p>

      {/* 班级选择 */}
      <div className="mb-6">
        <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
          className="px-3 py-2 border rounded-lg text-sm">
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">学生人数</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{currentClass?.students?.length || 0}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">已布置作业</p>
          <p className="text-3xl font-bold text-purple-600 mt-1">{classAssignments.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">提交数</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{classSubmissions.length}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">班级平均分</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{avgScore}</p>
        </div>
      </div>

      {/* 学生排名 */}
      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">学生排名</h2>
        {ranking.length === 0 ? (
          <p className="text-gray-400 text-center py-4">暂无数据</p>
        ) : (
          <div className="space-y-2">
            {ranking.map((r, i) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700">{r.id}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-400">{r.count} 次作业</span>
                  <span className={`font-bold ${r.avg >= 80 ? 'text-green-600' : r.avg >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {r.avg} 分
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 作业成绩列表 */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-bold mb-4">作业完成情况</h2>
        {classAssignments.length === 0 ? (
          <p className="text-gray-400 text-center py-4">暂无作业</p>
        ) : (
          <div className="space-y-2">
            {classAssignments.map(a => {
              const subs = classSubmissions.filter(s => s.assignment_id === a.id);
              const graded = subs.filter(s => s.status === 'GRADED');
              const avg = graded.length ? Math.round(graded.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / graded.length) : 0;
              return (
                <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-700">{a.title}</p>
                    <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleDateString('zh-CN')}</p>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">提交 {subs.length} 人</span>
                    <span className="font-bold text-blue-600">均分 {avg}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
