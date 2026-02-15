'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';

export default function ProgressPage() {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/plugins/homework/my-submissions')
      .then(data => setSubmissions(Array.isArray(data) ? data : []))
      .catch((err: any) => { setError(err.message || '加载失败'); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">加载中...</div>;

  const total = submissions.length;
  const graded = submissions.filter(s => s.status === 'GRADED');
  const avgScore = graded.length ? Math.round(graded.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / graded.length) : 0;

  // Group by subject
  const bySubject: Record<string, { count: number; totalScore: number; graded: number }> = {};
  for (const s of submissions) {
    const subj = s.subject_id || '未分类';
    if (!bySubject[subj]) bySubject[subj] = { count: 0, totalScore: 0, graded: 0 };
    bySubject[subj].count++;
    if (s.status === 'GRADED' && s.score !== null) {
      bySubject[subj].graded++;
      bySubject[subj].totalScore += s.score;
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">学习进度</h1>
      <p className="text-gray-500 text-sm mb-6">查看你的学习统计和成绩</p>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      {/* 统计卡片 */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">总提交数</p>
          <p className="text-3xl font-bold text-blue-600 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">已批改</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{graded.length}</p>
          <p className="text-xs text-gray-400 mt-1">完成率 {total ? Math.round(graded.length / total * 100) : 0}%</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-sm text-gray-500">平均分</p>
          <p className="text-3xl font-bold text-orange-600 mt-1">{avgScore}</p>
        </div>
      </div>

      {/* 学科成绩 */}
      {Object.keys(bySubject).length > 0 && (
        <div className="bg-white rounded-xl border p-6 mb-8">
          <h2 className="text-lg font-bold mb-4">按学科统计</h2>
          <div className="space-y-3">
            {Object.entries(bySubject).map(([subj, data]) => {
              const avg = data.graded ? Math.round(data.totalScore / data.graded) : 0;
              return (
                <div key={subj} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b last:border-0 gap-1">
                  <span className="font-medium text-gray-700">{subj}</span>
                  <div className="flex items-center gap-4 sm:gap-6 text-sm">
                    <span className="text-gray-400">作业 {data.count} 次</span>
                    <span className="text-gray-400">已批改 {data.graded} 次</span>
                    <span className="font-bold text-blue-600">{avg} 分</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 最近成绩 */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-bold mb-4">最近作业成绩</h2>
        {graded.length === 0 ? (
          <p className="text-gray-400 text-center py-4">暂无批改记录</p>
        ) : (
          <div className="space-y-2">
            {graded.slice(0, 20).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{s.assignment_title}</p>
                  <p className="text-xs text-gray-400">{new Date(s.submitted_at).toLocaleString('zh-CN')}</p>
                </div>
                <span className={`text-lg font-bold ${(s.score || 0) >= 80 ? 'text-green-600' : (s.score || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {s.score ?? '--'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
