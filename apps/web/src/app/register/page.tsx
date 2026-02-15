'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type RoleType = 'TEACHER' | 'STUDENT' | 'ADMIN';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleType>('TEACHER');
  const [schoolName, setSchoolName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [adminAvailable, setAdminAvailable] = useState(false);

  useEffect(() => {
    apiFetch('/api/auth/admin-available')
      .then((data) => setAdminAvailable(data.available))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const body: Record<string, string> = { name, email, password, role };
      if (role === 'ADMIN') {
        body.schoolName = schoolName;
      }
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
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
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">{error}</div>}

          {/* 角色选择 */}
          <div className={`grid gap-3 ${adminAvailable ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button type="button" onClick={() => setRole('TEACHER')}
              className={`py-3 rounded-xl font-medium border-2 transition text-sm ${role === 'TEACHER' ? 'border-blue-600 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-500'}`}>
              <span className="block text-lg mb-1">👩‍🏫</span>我是教师
            </button>
            <button type="button" onClick={() => setRole('STUDENT')}
              className={`py-3 rounded-xl font-medium border-2 transition text-sm ${role === 'STUDENT' ? 'border-green-600 bg-green-50 text-green-600' : 'border-gray-200 text-gray-500'}`}>
              <span className="block text-lg mb-1">👨‍🎓</span>我是学生
            </button>
            {adminAvailable && (
              <button type="button" onClick={() => setRole('ADMIN')}
                className={`py-3 rounded-xl font-medium border-2 transition text-sm ${role === 'ADMIN' ? 'border-purple-600 bg-purple-50 text-purple-600' : 'border-gray-200 text-gray-500'}`}>
                <span className="block text-lg mb-1">🏫</span>我是机构
              </button>
            )}
          </div>

          {role === 'ADMIN' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">机构名称</label>
              <input type="text" required value={schoolName} onChange={e => setSchoolName(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500" placeholder="学校或机构名称" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{role === 'ADMIN' ? '管理员姓名' : '姓名'}</label>
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
