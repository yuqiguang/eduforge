import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 font-bold text-xl">E</div>
          <span className="text-2xl font-bold text-white">EduForge</span>
        </div>
        <div className="flex gap-4">
          <Link href="/login" className="px-4 py-2 text-white hover:text-blue-200 transition">登录</Link>
          <Link href="/register" className="px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition">注册</Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-8 pt-24 pb-32 text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
          开源教育 AI 引擎
        </h1>
        <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-2xl mx-auto">
          让每个学生都有 AI 老师。插件化架构，按需组合，社区共建。
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/register" className="px-8 py-4 bg-white text-blue-600 rounded-xl font-bold text-lg hover:bg-blue-50 transition shadow-lg">
            开始使用
          </Link>
          <a href="https://github.com/your-org/eduforge" target="_blank" className="px-8 py-4 border-2 border-white text-white rounded-xl font-bold text-lg hover:bg-white/10 transition">
            GitHub ⭐
          </a>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-24 text-left">
          <Feature icon="🧩" title="插件化架构" desc="核心引擎小而精，题库、作业、批改、错题本全部插件化。按需安装，灵活组合。" />
          <Feature icon="🤖" title="AI 原生" desc="内置 AI 网关，支持通义千问、DeepSeek、文心一言等国产大模型，智能批改开箱即用。" />
          <Feature icon="🔒" title="数据自控" desc="支持私有部署，数据不出校。信创兼容，支持国产操作系统和数据库。" />
          <Feature icon="📚" title="K12 适配" desc="适配中国教材体系，覆盖人教版、北师大版等主流版本，知识点精准对齐。" />
          <Feature icon="👥" title="社区共建" desc="开源社区 + 插件市场，教师和开发者共同构建教育生态。" />
          <Feature icon="⚡" title="轻量部署" desc="Docker 一键部署，三四线城市学校也能轻松使用。" />
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8 text-blue-200 text-sm">
        EduForge · 开源教育 AI 引擎 · MIT License
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl p-6">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-blue-100 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
