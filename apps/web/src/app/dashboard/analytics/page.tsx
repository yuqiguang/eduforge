export default function Page() {
  const titles: Record<string, string> = {
    classes: '班级管理', analytics: '学情分析',
    'my-assignments': '我的作业', mistakes: '错题本', progress: '学习进度',
  };
  const name = 'analytics';
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">{titles[name] || name}</h1>
      <div className="bg-white rounded-xl border p-12 text-center">
        <div className="text-4xl mb-3">🚧</div>
        <p className="text-gray-500">功能开发中，敬请期待</p>
      </div>
    </div>
  );
}
