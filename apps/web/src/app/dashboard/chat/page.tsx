'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { apiFetch } from '@/lib/api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ── Types ──────────────────────────────────────────────
interface Session { id: string; title: string; updated_at: string; created_at: string }
interface Message {
  role: 'user' | 'assistant';
  content: string;
  confirm?: { actionId: string; preview: string };
  toolStatus?: string;
}

// ── Simple markdown with DOMPurify sanitization ────────
function renderMarkdown(text: string) {
  let html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-800 text-green-200 rounded p-3 my-2 overflow-x-auto text-sm"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-200 text-pink-600 px-1 rounded text-sm">$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^\- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n/g, '<br/>');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['pre', 'code', 'strong', 'li', 'br', 'ul', 'ol', 'em', 'p', 'span'],
    ALLOWED_ATTR: ['class'],
  });
}

// ── SSE stream with fetch fallback ─────────────────────
function streamChat(
  sessionId: string | null,
  message: string,
  onEvent: (event: string, data: any) => void,
  onError: (err: any) => void,
  onDone: () => void,
) {
  const params = new URLSearchParams({ message });
  if (sessionId) params.set('sessionId', sessionId);
  const url = `${API_BASE}/api/chat/stream?${params}`;
  const ctrl = new AbortController();

  fetch(url, {
    credentials: 'include',
    signal: ctrl.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`stream ${res.status}`);
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let currentEvent = 'message';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop()!;
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onEvent(currentEvent, data);
            } catch { /* ignore malformed SSE chunks */ }
            currentEvent = 'message'; // reset after data
          }
        }
      }
      onDone();
    })
    .catch((err) => {
      if (err.name === 'AbortError') return;
      onError(err);
    });

  return () => ctrl.abort();
}

// ── Component ──────────────────────────────────────────
export default function ChatPage() {
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [error, setError] = useState('');
  const messagesEnd = useRef<HTMLDivElement>(null);
  const abortRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const s = localStorage.getItem('user');
    if (s) {
      try {
        setUser(JSON.parse(s));
      } catch (err: any) {
        setError(err.message || '加载失败');
      }
    }
  }, []);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const data = await apiFetch('/api/chat/sessions');
      setSessions(Array.isArray(data) ? data : data.sessions ?? []);
    } catch (err: any) {
      setError(err.message || '加载失败');
    }
  }, []);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load messages for active session
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    (async () => {
      try {
        const data = await apiFetch(`/api/chat/sessions/${activeId}/messages`);
        const raw: any[] = Array.isArray(data) ? data : data.messages ?? [];
        // Convert DB rows to Message format, filtering out tool-role messages
        const msgs: Message[] = raw
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map((m: any) => ({ role: m.role, content: m.content || '' }));
        setMessages(msgs);
      } catch (err: any) {
        setError(err.message || '加载失败');
        setMessages([]);
      }
    })();
  }, [activeId]);

  // Auto scroll
  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, thinking]);

  // ── Send message ─────────────────────────────────────
  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    setInput('');
    setSending(true);
    setError('');
    setThinking('正在思考...');

    let sid = activeId;

    // Create session if needed
    if (!sid) {
      try {
        const s = await apiFetch('/api/chat/sessions', {
          method: 'POST',
          body: JSON.stringify({ title: msg.slice(0, 30) }),
        });
        sid = s.id;
        setActiveId(sid);
        loadSessions();
      } catch (err: any) {
        setError(err.message || '创建会话失败');
        setSending(false);
        setThinking('');
        return;
      }
    }

    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);

    // Try streaming first, fallback to POST
    let assistantContent = '';
    const updateAssistant = (content: string, extra?: Partial<Message>) => {
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.confirm) {
          return [...prev.slice(0, -1), { ...last, content, ...extra }];
        }
        return [...prev, { role: 'assistant', content, ...extra }];
      });
    };

    const cancel = streamChat(
      sid!,
      msg,
      (event, data) => {
        switch (event) {
          case 'session':
            if (data.sessionId && data.sessionId !== sid) {
              setActiveId(data.sessionId);
            }
            break;
          case 'content':
            assistantContent += data.text;
            updateAssistant(assistantContent);
            setThinking('');
            break;
          case 'tool_call':
            setThinking(data.description || `正在调用 ${data.name}...`);
            break;
          case 'tool_result':
            setThinking('');
            break;
          case 'confirm':
            setThinking('');
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: '',
              confirm: { actionId: data.actionId, preview: data.preview },
            }]);
            break;
          case 'done':
            break;
          case 'error':
            setThinking('');
            updateAssistant(`⚠️ ${data.error || '请求失败'}`);
            break;
        }
      },
      // On stream error → fallback to POST
      async () => {
        try {
          const res = await apiFetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ sessionId: sid, message: msg }),
          });
          const reply = res.reply ?? res.content ?? res.message ?? JSON.stringify(res);
          updateAssistant(typeof reply === 'string' ? reply : JSON.stringify(reply));
        } catch (e: any) {
          updateAssistant(`⚠️ ${e.message || '请求失败'}`);
        }
        setSending(false);
        setThinking('');
      },
      () => {
        setSending(false);
        setThinking('');
        loadSessions();
      },
    );
    abortRef.current = cancel;
  }, [input, sending, activeId, loadSessions]);

  // ── Confirm / Cancel ─────────────────────────────────
  const handleConfirm = async (actionId: string) => {
    try { await apiFetch(`/api/chat/confirm/${actionId}`, { method: 'POST' }); } catch (err: any) { setError(err.message || '加载失败'); }
    setMessages(prev => prev.filter(m => m.confirm?.actionId !== actionId));
  };
  const handleCancel = async (actionId: string) => {
    try { await apiFetch(`/api/chat/cancel/${actionId}`, { method: 'POST' }); } catch (err: any) { setError(err.message || '加载失败'); }
    setMessages(prev => prev.filter(m => m.confirm?.actionId !== actionId));
  };

  // ── New session ──────────────────────────────────────
  const newChat = () => { setActiveId(null); setMessages([]); };

  const isTeacher = user?.role !== 'STUDENT';
  const quickActions = isTeacher
    ? ['帮我出10道数学题', '查看七年级一班的成绩', '布置一次英语作业']
    : ['帮我复习错题', '这道方程怎么解', '我的作业情况'];

  // ── Render ───────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 sm:-m-6 overflow-hidden">
      {/* Sidebar - desktop inline, mobile overlay */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-200 overflow-hidden border-r bg-white flex-shrink-0 hidden md:block`}>
        <div className="w-64 h-full flex flex-col">
          <div className="p-3 border-b">
            <button onClick={newChat}
              className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
              ＋ 新对话
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.map(s => (
              <button key={s.id} onClick={() => { setActiveId(s.id); setSidebarOpen(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition ${activeId === s.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                <div className="truncate">{s.title || '新对话'}</div>
                <div className="text-xs text-gray-400 mt-0.5">{new Date(s.updated_at).toLocaleDateString()}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-30 flex">
          <div className="w-64 bg-white border-r h-full flex flex-col shadow-lg">
            <div className="p-3 border-b flex items-center justify-between">
              <button onClick={newChat}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                ＋ 新对话
              </button>
              <button onClick={() => setSidebarOpen(false)} className="ml-2 p-2 text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map(s => (
                <button key={s.id} onClick={() => { setActiveId(s.id); setSidebarOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate transition ${activeId === s.id ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <div className="truncate">{s.title || '新对话'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{new Date(s.updated_at).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 bg-black/20" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Toggle sidebar button (desktop) */}
      <button onClick={() => setSidebarOpen(!sidebarOpen)}
        className="hidden md:flex absolute top-1/2 z-10 w-5 h-10 items-center justify-center bg-white border rounded-r text-gray-400 hover:text-gray-600"
        style={{ left: sidebarOpen ? 'calc(16rem - 10px)' : 0 }}>
        {sidebarOpen ? '‹' : '›'}
      </button>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-white">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className="text-sm text-gray-600 truncate">{activeId ? sessions.find(s => s.id === activeId)?.title || '对话' : 'AI 助手'}</span>
          <button onClick={newChat} className="ml-auto text-sm text-blue-600 font-medium px-2 py-1">+ 新对话</button>
        </div>
        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4 mx-4 mt-2">{error}</div>}
        {/* Empty state */}
        {!activeId && messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-6">🤖</div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">EduForge AI 助手</h2>
              <p className="text-gray-500 mb-6 text-sm">我可以帮你管理题库、布置作业、分析学情</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions.map(q => (
                  <button key={q} onClick={() => send(q)}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, i) => {
                if (m.confirm) {
                  return (
                    <div key={i} className="flex justify-start">
                      <div className="bg-white border border-blue-200 rounded-xl p-4 max-w-md shadow-sm">
                        <div className="text-sm font-medium text-gray-700 mb-2">📋 即将执行</div>
                        <div className="text-sm text-gray-600 mb-3">{m.confirm.preview}</div>
                        <div className="flex gap-2">
                          <button onClick={() => handleConfirm(m.confirm!.actionId)}
                            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
                            ✅ 确认执行
                          </button>
                          <button onClick={() => handleCancel(m.confirm!.actionId)}
                            className="px-4 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 transition">
                            ❌ 取消
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                const isUser = m.role === 'user';
                return (
                  <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isUser ? 'bg-blue-600 text-white' : 'bg-white border text-gray-800'}`}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                  </div>
                );
              })}
              {thinking && (
                <div className="flex justify-start">
                  <div className="bg-white border rounded-2xl px-4 py-2.5 text-sm text-gray-500 animate-pulse">
                    {thinking}
                  </div>
                </div>
              )}
              <div ref={messagesEnd} />
            </div>

            {/* Input */}
            <div className="border-t bg-white p-4">
              <div className="flex gap-2 max-w-3xl mx-auto">
                <textarea
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="输入消息..."
                  disabled={sending}
                  rows={1}
                  className="flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button onClick={() => send()} disabled={sending || !input.trim()}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex-shrink-0">
                  发送
                </button>
              </div>
            </div>
          </>
        )}

        {/* Input for empty state too */}
        {!activeId && messages.length === 0 && (
          <div className="border-t bg-white p-4">
            <div className="flex gap-2 max-w-3xl mx-auto">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="输入消息..."
                disabled={sending}
                rows={1}
                className="flex-1 resize-none border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              />
              <button onClick={() => send()} disabled={sending || !input.trim()}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition flex-shrink-0">
                发送
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
