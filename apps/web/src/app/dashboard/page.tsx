'use client';

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">E</div>
          <span className="font-bold text-lg">EduForge</span>
        </div>
        <button onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
          className="text-sm text-gray-500 hover:text-gray-700">退出</button>
      </nav>
      <main className="max-w-6xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">控制面板</h1>
        <div className="grid md:grid-cols-3 gap-6">
          <Card title="📚 题库" desc="管理题目、知识点" href="/dashboard/questions" />
          <Card title="📋 作业" desc="布置和管理作业" href="/dashboard/assignments" />
          <Card title="📊 学情" desc="查看学生学习数据" href="/dashboard/analytics" />
          <Card title="🤖 AI 设置" desc="配置 AI 大模型" href="/dashboard/ai-settings" />
          <Card title="👥 班级" desc="管理班级和学生" href="/dashboard/classes" />
          <Card title="⚙️ 设置" desc="系统和个人设置" href="/dashboard/settings" />
        </div>
      </main>
    </div>
  );
}

function Card({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <a href={href} className="block bg-white rounded-xl p-6 border hover:shadow-md transition">
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="text-sm text-gray-500">{desc}</p>
    </a>
  );
}
