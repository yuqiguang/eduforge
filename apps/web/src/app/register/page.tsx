'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type RoleOption = 'TEACHER' | 'STUDENT' | 'ADMIN' | 'INDEPENDENT';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleOption | null>(null);
  const [schoolName, setSchoolName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ hasSchool: boolean; schoolName: string | null; allowTeacher: boolean } | null>(null);

  useEffect(() => {
    apiFetch('/api/auth/register-status')
      .then((data) => {
        setStatus(data);
        // 默认选中第一个可用选项
        if (data.hasSchool) {
          setRole(data.allowTeacher ? 'TEACHER' : 'STUDENT');
        } else {
          setRole('INDEPENDENT');
        }
      })
      .catch(() => setStatus({ hasSchool: false, schoolName: null, allowTeacher: false }));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    setError('');

    try {
      const body: Record<string, any> = { name, email, password };

      if (role === 'INDEPENDENT') {
        // 独立教师 → ADMIN + independent + 自动生成学校名
        body.role = 'ADMIN';
        body.independent = true;
        body.schoolName = schoolName || `${name}的教室`;
      } else if (role === 'ADMIN') {
        body.role = 'ADMIN';
        body.schoolName = schoolName;
      } else {
        body.role = role; // TEACHER or STUDENT
      }

      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'ADMIN') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!status) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full px-4 sm:p-8">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold">E</div>
            <span className="text-2xl font-bold">EduForge</span>
          </Link>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">创建账号</h2>
          {status.hasSchool && status.schoolName && (
            <p className="mt-2 text-sm text-gray-500">加入「{status.schoolName}」</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {/* 角色选择 — 根据系统状态动态展示 */}
          {status.hasSchool ? (
            // 已有学校：根据模式显示选项
            status.allowTeacher ? (
              // 机构模式：教师 + 学生
              <div className="grid grid-cols-2 gap-3">
                <RoleButton selected={role === 'TEACHER'} onClick={() => setRole('TEACHER')}
                  emoji="👩‍🏫" label="我是教师" color="blue" />
                <RoleButton selected={role === 'STUDENT'} onClick={() => setRole('STUDENT')}
                  emoji="👨‍🎓" label="我是学生" color="green" />
              </div>
            ) : (
              // 独立教师模式：只有学生
              <div>
                <div className="grid grid-cols-1 gap-3">
                  <RoleButton selected={role === 'STUDENT'} onClick={() => setRole('STUDENT')}
                    emoji="👨‍🎓" label="我是学生" color="green" />
                </div>
                <p className="mt-2 text-xs text-gray-400 text-center">当前系统为独立教师模式，仅开放学生注册</p>
              </div>
            )
          ) : (
            // 无学校：显示独立教师和机构入口
            <div className="grid grid-cols-2 gap-3">
              <RoleButton selected={role === 'INDEPENDENT'} onClick={() => setRole('INDEPENDENT')}
                emoji="👩‍🏫" label="独立教师" color="blue" />
              <RoleButton selected={role === 'ADMIN'} onClick={() => setRole('ADMIN')}
                emoji="🏫" label="我是机构" color="purple" />
            </div>
          )}

          {/* 独立教师提示 */}
          {role === 'INDEPENDENT' && (
            <div className="bg-blue-50 text-blue-700 px-4 py-3 rounded-lg text-sm">
              独立教师注册后拥有管理员权限，可以管理学生账号和系统设置。
            </div>
          )}

          {/* 机构/独立教师 名称输入 */}
          {(role === 'ADMIN' || role === 'INDEPENDENT') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {role === 'ADMIN' ? '机构名称' : '教室名称（选填）'}
              </label>
              <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                required={role === 'ADMIN'}
                className={`w-full px-4 py-3 border rounded-xl focus:ring-2 ${role === 'ADMIN' ? 'focus:ring-purple-500 focus:border-purple-500' : 'focus:ring-blue-500 focus:border-blue-500'}`}
                placeholder={role === 'ADMIN' ? '学校或机构名称' : `默认为"你的名字的教室"`} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {role === 'ADMIN' ? '管理员姓名' : '姓名'}
            </label>
            <input type="text" required value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="你的名字" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="your@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="至少6个字符" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50">
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          已有账号？<Link href="/login" className="text-blue-600 font-medium">立即登录</Link>
        </p>
      </div>
    </div>
  );
}

function RoleButton({ selected, onClick, emoji, label, color }: {
  selected: boolean; onClick: () => void; emoji: string; label: string; color: 'blue' | 'green' | 'purple';
}) {
  const colorMap = {
    blue: { active: 'border-blue-600 bg-blue-50 text-blue-600', inactive: 'border-gray-200 text-gray-500' },
    green: { active: 'border-green-600 bg-green-50 text-green-600', inactive: 'border-gray-200 text-gray-500' },
    purple: { active: 'border-purple-600 bg-purple-50 text-purple-600', inactive: 'border-gray-200 text-gray-500' },
  };
  return (
    <button type="button" onClick={onClick}
      className={`py-3 rounded-xl font-medium border-2 transition text-sm ${selected ? colorMap[color].active : colorMap[color].inactive}`}>
      <span className="block text-lg mb-1">{emoji}</span>{label}
    </button>
  );
}
