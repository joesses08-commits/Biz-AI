"use client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Send, ArrowLeft, Loader2, Sparkles, RotateCcw } from "lucide-react";
import ReactMarkdown from "react-markdown";

const SUGGESTED = [
  "What needs my attention right now?",
  "Which products still need samples?",
  "Message joeys factory about bread box asking for an update",
  "What's the status of all my factory tracks?",
  "Create a PO for spice rack and email to joeys factory",
  "Which factories have the most revisions?",
  "Update bread box at georges factory to sample shipped",
  "Which products are approved and ready to order?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  actions?: string[];
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

export default function PLMAgentPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(() => typeof window !== "undefined" ? localStorage.getItem("plm_agent_draft") || "" : "");
  const [loading, setLoading] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chats from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("plm-agent-chats");
      if (saved) {
        const parsed = JSON.parse(saved);
        setChats(parsed);
        if (parsed.length > 0) {
          setCurrentChatId(parsed[0].id);
          setMessages(parsed[0].messages);
        }
      } else {
        // Auto-create first chat on fresh load
        const id = Date.now().toString();
        const newChat: Chat = { id, title: "New chat", messages: [], updatedAt: new Date().toISOString() };
        setChats([newChat]);
        setCurrentChatId(id);
        saveChats([newChat]);
      }
    } catch {}
  }, []);

  const saveChats = (updatedChats: Chat[]) => {
    try { localStorage.setItem("plm-agent-chats", JSON.stringify(updatedChats)); } catch {}
  };

  const startNewChat = () => {
    const id = Date.now().toString();
    const newChat: Chat = { id, title: "New chat", messages: [], updatedAt: new Date().toISOString() };
    const updated = [newChat, ...chats];
    setChats(updated);
    setCurrentChatId(id);
    setMessages([]);
    saveChats(updated);
  };

  const loadChat = (chat: Chat) => {
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
  };

  const chatsRef = useRef<Chat[]>([]);
  const currentChatIdRef = useRef<string | null>(null);
  
  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { currentChatIdRef.current = currentChatId; }, [currentChatId]);

  const updateCurrentChat = (newMessages: Message[]) => {
    const id = currentChatIdRef.current;
    if (!id) return;
    const title = newMessages.find(m => m.role === "user")?.content.slice(0, 40) || "New chat";
    const updated = chatsRef.current.map(c => c.id === id ? { ...c, messages: newMessages, title, updatedAt: new Date().toISOString() } : c);
    setChats(updated);
    saveChats(updated);
  };

  // Save on message change
  useEffect(() => {
    if (currentChatIdRef.current && messages.length > 0) updateCurrentChat(messages);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput(""); localStorage.removeItem("plm_agent_draft");

    // Auto-create a chat if none exists
    let activeChatId = currentChatId;
    let activeChats = chats;
    if (!activeChatId) {
      const id = Date.now().toString();
      const newChat: Chat = { id, title: msg.slice(0, 40), messages: [], updatedAt: new Date().toISOString() };
      activeChats = [newChat, ...chats];
      setChats(activeChats);
      setCurrentChatId(id);
      activeChatId = id;
      saveChats(activeChats);
    }

    const userMsg: Message = { role: "user", content: msg };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/plm/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: newMessages.slice(-8).slice(0, -1).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (res.status === 402) {
        setMessages(prev => [...prev, { role: "assistant", content: "⚠️ You've used up your AI quota for this month. Go to [AI Tokens](/quota) to top up." }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: data.reply || "Sorry, I couldn't get a response.", actions: data.actions || [] }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Something went wrong. Try again." }]);
    }
    setLoading(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      {/* Sidebar */}
      <div className="w-64 border-r border-white/[0.06] flex flex-col flex-shrink-0 h-screen sticky top-0">
        <div className="px-4 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Chats</p>
          <button onClick={startNewChat} className="w-6 h-6 rounded-lg border border-white/[0.08] flex items-center justify-center text-white/30 hover:text-white/60 hover:border-white/20 transition text-sm">+</button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {chats.length === 0 ? (
            <p className="text-[11px] text-white/20 px-4 py-3">No chats yet</p>
          ) : chats.map(chat => (
            <button key={chat.id} onClick={() => loadChat(chat)}
              className={`w-full text-left px-4 py-2.5 hover:bg-white/[0.03] transition group \${currentChatId === chat.id ? "bg-white/[0.04]" : ""}`}>
              <p className={`text-xs truncate \${currentChatId === chat.id ? "text-white/80" : "text-white/40"}`}>{chat.title}</p>
              <p className="text-[10px] text-white/20 mt-0.5">{new Date(chat.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/plm")} className="text-white/30 hover:text-white/60 transition">
            <ArrowLeft size={16} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/30 to-pink-500/30 border border-violet-500/20 flex items-center justify-center">
            <Sparkles size={12} className="text-violet-300" />
          </div>
          <div>
            <p className="text-sm font-semibold">PLM Agent</p>
            <p className="text-[10px] text-white/30">Ask anything about your products, factories & samples</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={startNewChat} className="flex items-center gap-1.5 text-[11px] text-white/25 hover:text-white/50 transition">
            <RotateCcw size={11} />New chat
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 max-w-3xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20 flex items-center justify-center">
              <Sparkles size={22} className="text-violet-300" />
            </div>
            <div>
              <h2 className="text-lg font-bold mb-1">PLM Agent</h2>
              <p className="text-white/30 text-sm max-w-sm">Ask me anything about your products, factories, samples, prices, or what needs attention right now.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-left text-xs px-4 py-3 rounded-xl border border-white/[0.06] text-white/40 hover:text-white/70 hover:border-white/15 hover:bg-white/[0.02] transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2.5">
                    <Sparkles size={10} className="text-violet-300" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-white/[0.06] border border-white/[0.08] text-white/80 rounded-tr-sm"
                    : "text-white/80 rounded-tl-sm"
                }`}>
                  {m.role === "assistant" ? (
                    <div>
                      <ReactMarkdown components={{
                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                        strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                        ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>,
                        li: ({ children }) => <li className="text-white/70">{children}</li>,
                        code: ({ children }) => <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-xs text-violet-300 font-mono">{children}</code>,
                      }}>
                        {m.content}
                      </ReactMarkdown>
                      {m.actions && m.actions.length > 0 && (
                        <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
                          {m.actions.map((action: string, i: number) => {
                            const tool = action.split(":")[0].trim();
                            const TOOL_LABELS: Record<string, string> = {
                              request_sample: "Sample requested",
                              send_message: "Message sent",
                              update_track_stage: "Stage updated",
                              add_note: "Note added",
                              create_order: "Order created",
                              send_po_email: "PO email sent",
                              get_messages: "Messages read",
                              get_product_details: "Product details fetched",
                            };
                            const label = TOOL_LABELS[tool] || tool;
                            return (
                              <div key={i} className="flex items-center gap-2 text-[11px]">
                                <span className="text-emerald-400 flex-shrink-0">✓</span>
                                <span className="text-white/40">{label}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500/20 to-pink-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0 mt-0.5 mr-2.5">
                  <Sparkles size={10} className="text-violet-300" />
                </div>
                <div className="flex items-center gap-1.5 px-4 py-3">
                  {[0,1,2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400/50 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/[0.06] px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-3 bg-white/[0.03] border border-white/[0.08] rounded-2xl px-4 py-3 focus-within:border-white/15 transition">
            <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); localStorage.setItem("plm_agent_draft", e.target.value); }} onKeyDown={handleKey}
              placeholder="Ask anything about your products, factories, or samples..."
              rows={1} className="flex-1 bg-transparent text-white/80 placeholder-white/20 text-sm focus:outline-none resize-none leading-relaxed"
              style={{ maxHeight: "120px" }}
              onInput={e => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }} />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl bg-violet-500 flex items-center justify-center flex-shrink-0 disabled:opacity-30 hover:bg-violet-400 transition">
              {loading ? <Loader2 size={13} className="animate-spin text-white" /> : <Send size={13} className="text-white" />}
            </button>
          </div>
          <p className="text-center text-[10px] text-white/15 mt-2">Uses real data from your PLM — prices, stages, factories, revisions</p>
        </div>
      </div>
      </div>
    </div>
  );
}
