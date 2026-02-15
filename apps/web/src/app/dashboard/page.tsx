'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [plugins, setPlugins] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        setUser(u);
        loadStats(u);
      } catch (err: any) {
        setError(err.message || '加载失败');
      }
    }
    apiFetch('/api/plugins').then(setPlugins).catch((err: any) => {
      setError(err.message || '加载失败');
    });
  }, []);

  async function loadStats(u: any) {
    setLoading(true);
    try {
      if (u.role === 'STUDENT') {
        const [assignData, subData] = await Promise.all([
          apiFetch('/api/plugins/homework/assignments').catch((err: any) => { setError(err.message || '加载失败'); return []; }),
          apiFetch('/api/plugins/homework/my-submissions').catch((err: any) => { setError(err.message || '加载失败'); return []; }),
        ]);
        const assignments = Array.isArray(assignData) ? assignData : [];
        const submissions = Array.isArray(subData) ? subData : [];
        const submittedIds = new Set(submissions.map((s: any) => s.assignment_id));
        const pending = assignments.filter((a: any) => !submittedIds.has(a.id) && a.status === 'ACTIVE');
        const graded = submissions.filter((s: any) => s.status === 'GRADED');
        const avgScore = graded.length > 0
          ? Math.round(graded.reduce((sum: number, s: any) => sum + (s.score || 0), 0) / graded.length)
          : 0;

        setStats({ pending: pending.length, completed: submissions.length, avgScore, wrongCount: 0 });
        // Recent activities from submissions
        const recent = submissions
          .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
          .slice(0, 5)
          .map((s: any) => ({
            text: `提交了「${s.assignment_title || '作业'}」`,
            detail: s.status === 'GRADED' ? `得分: ${s.score}分` : '等待批改',
            time: s.submitted_at,
            icon: s.status === 'GRADED' ? '✅' : '⏳',
          }));
        setActivities(recent);
      } else {
        const [qData, subData, classData] = await Promise.all([
          apiFetch('/api/plugins/question-bank/questions?limit=1').catch((err: any) => { setError(err.message || '加载失败'); return { total: 0 }; }),
          apiFetch('/api/plugins/homework/submissions?status=SUBMITTED').catch((err: any) => { setError(err.message || '加载失败'); return []; }),
          apiFetch('/api/classes').catch((err: any) => { setError(err.message || '加载失败'); return []; }),
        ]);
        const classes = Array.isArray(classData) ? classData : [];
        const submissions = Array.isArray(subData) ? subData : [];
        const studentCount = classes.reduce((sum: number, c: any) => sum + (c.student_count || c.studentCount || c.students?.length || 0), 0);

        setStats({
          questions: qData.total ?? qData.length ?? 0,
          pendingGrade: submissions.length,
          classCount: classes.length,
          studentCount,
        });
        // Recent: latest submissions
        const recent = submissions
          .sort((a: any, b: any) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime())
          .slice(0, 5)
          .map((s: any) => ({
            text: `${s.student_name || '学生'} 提交了「${s.assignment_title || '作业'}」`,
            detail: '待批改',
            time: s.submitted_at || s.created_at,
            icon: '📝',
          }));
        setActivities(recent);
      }
    } catch (err: any) {
      setError(err.message || '加载失败');
    }
    setLoading(false);
  }

  if (!user) return null;

  const isStudent = user.role === 'STUDENT';

  const teacherCards = [
    { label: '题库总数', value: stats.questions ?? '--', icon: '📚', color: 'blue' },
    { label: '待批改', value: stats.pendingGrade ?? '--', icon: '📋', color: 'green' },
    { label: '班级数', value: stats.classCount ?? '--', icon: '👥', color: 'purple' },
    { label: '学生总数', value: stats.studentCount ?? '--', icon: '🎓', color: 'orange' },
  ];

  const studentCards = [
    { label: '待完成作业', value: stats.pending ?? '--', icon: '📝', color: 'blue' },
    { label: '已完成作业', value: stats.completed ?? '--', icon: '✅', color: 'green' },
    { label: '平均分', value: stats.avgScore !== undefined ? `${stats.avgScore}分` : '--', icon: '📊', color: 'purple' },
    { label: '错题数', value: stats.wrongCount ?? '--', icon: '❌', color: 'orange' },
  ];

  const cards = isStudent ? studentCards : teacherCards;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">欢迎回来，{user.name}</h1>
      <p className="text-gray-500 mb-8">{isStudent ? '这是你的学习工作台' : '这是你的教学工作台'}</p>

      {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(c => (
          <StatCard key={c.label} label={c.label} value={loading ? '...' : String(c.value)} icon={c.icon} color={c.color} />
        ))}
      </div>

      {/* 最近动态 */}
      <div className="bg-white rounded-xl border p-6 mb-8">
        <h2 className="text-lg font-bold mb-4">最近动态</h2>
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((a, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                <span className="text-xl">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{a.text}</p>
                  <p className="text-xs text-gray-400">{a.detail}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {a.time ? new Date(a.time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">{loading ? '加载中...' : '暂无动态'}</p>
        )}
      </div>

      {/* 已加载插件 */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-bold mb-4">已加载插件</h2>
        {plugins.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {plugins.map((p: any) => (
              <div key={p.name} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{p.displayName || p.name}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">v{p.version}</span>
                </div>
                <p className="text-sm text-gray-500">{p.description || '无描述'}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">加载中...</p>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
