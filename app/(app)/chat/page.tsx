"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface PendingApproval {
  action: string;
  details: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  pendingApproval?: PendingApproval;
  conversationState?: any[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

const QUICK_ACTIONS = [
  "What needs my attention today?",
  "What are my biggest risks right now?",
  "Where can I make more money?",
  "How's my cash position?",
  "What should I do this week?",
];

function generateId() {
  return Math.random().toString(36).slice(2);
}

function getTitle(messages: Message[]) {
  const first = messages.find(m => m.role === "user");
  if (!first) return "New conversation";
  return first.content.slice(0, 40) + (first.content.length > 40 ? "..." : "");
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingConversationState, setPendingConversationState] = useState<any[]>([]);
  const [savedConversationState, setSavedConversationState] = useState<any[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find(c => c.id === activeId);
  const messages = activeConversation?.messages || [];

  useEffect(() => {
    const saved = localStorage.getItem("bizai_conversations");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConversations(parsed);
        if (parsed.length > 0) setActiveId(parsed[0].id);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("bizai_conversations", JSON.stringify(conversations));
    }
  }, [conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const newConversation = () => {
    const id = generateId();
    const conv: Conversation = {
      id,
      title: "New conversation",
      messages: [],
      createdAt: new Date().toISOString(),
    };
    setConversations(prev => [conv, ...prev]);
    setActiveId(id);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    let currentId = activeId;
    if (!currentId) {
      const id = generateId();
      const conv: Conversation = {
        id,
        title: "New conversation",
        messages: [],
        createdAt: new Date().toISOString(),
      };
      setConversations(prev => [conv, ...prev]);
      setActiveId(id);
      currentId = id;
    }

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    const assistantMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setConversations(prev => prev.map(c =>
      c.id === currentId
        ? { ...c, messages: [...c.messages, userMsg, assistantMsg], title: getTitle([...c.messages, userMsg]) }
        : c
    ));
    setInput("");
    setIsLoading(true);

    try {
      const currentMessages = conversations.find(c => c.id === currentId)?.messages || [];
      const history = [...currentMessages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      // If we have a saved state from a cancelled approval, continue from there
      let messagesToSend = history;
      if (savedConversationState.length > 0) {
        messagesToSend = [
          ...savedConversationState,
          { role: "user", content: content.trim() },
        ];
        setSavedConversationState([]);
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messagesToSend }),
      });

      const data = await res.json();

      if (res.status === 402) {
        const responseText = `⚠️ ${data.message} [Buy more tokens at myjimmy.ai/quota]`;
        setConversations(prev => prev.map(c =>
          c.id === currentId
            ? { ...c, messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: responseText } : m) }
            : c
        ));
      } else if (data.pendingApproval) {
        // Store conversation state for continuation after approval
        setPendingConversationState(data.conversationState || []);
        setConversations(prev => prev.map(c =>
          c.id === currentId
            ? { ...c, messages: c.messages.map(m => m.id === assistantMsg.id ? {
                ...m,
                content: data.message || "I'm ready to proceed.",
                pendingApproval: data.pendingApproval,
                conversationState: data.conversationState,
                pendingTools: data.pendingTools,
              } : m) }
            : c
        ));
      } else {
        const responseText = data.message || data.response || "Something went wrong.";
        setPendingConversationState([]);
        setConversations(prev => prev.map(c =>
          c.id === currentId
            ? { ...c, messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: responseText } : m) }
            : c
        ));
      }
    } catch {
      setConversations(prev => prev.map(c =>
        c.id === currentId
          ? { ...c, messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: "Something went wrong. Please try again." } : m) }
          : c
      ));
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleApprove = async (msg: Message) => {
    const currentId = activeId || conversations[0]?.id;
    setIsLoading(true);

    const assistantMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    };

    setConversations(prev => prev.map(c =>
      c.id === currentId
        ? { ...c, messages: [...c.messages, { id: generateId(), role: "user", content: "✅ Approved — go ahead.", timestamp: new Date().toISOString() }, assistantMsg] }
        : c
    ));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: msg.conversationState || [],
          approvedAction: true,
          pendingTools: (msg as any).pendingTools || [],
        }),
      });

      const data = await res.json();
      const responseText = data.message || "Done.";
      setConversations(prev => prev.map(c =>
        c.id === currentId
          ? { ...c, messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: responseText } : m) }
          : c
      ));
    } catch {
      setConversations(prev => prev.map(c =>
        c.id === currentId
          ? { ...c, messages: c.messages.map(m => m.id === assistantMsg.id ? { ...m, content: "Something went wrong." } : m) }
          : c
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = (msg: Message) => {
    const currentId = activeId || conversations[0]?.id;
    // Save conversation state so next message can continue from here
    if (msg.conversationState) {
      setSavedConversationState(msg.conversationState);
    }
    setConversations(prev => prev.map(c =>
      c.id === currentId
        ? { ...c, messages: [...c.messages, { id: generateId(), role: "user", content: "❌ Cancelled.", timestamp: new Date().toISOString() }, { id: generateId(), role: "assistant", content: "Got it — what would you like to change?", timestamp: new Date().toISOString() }] }
        : c
    ));
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">

      {/* Sidebar — chat history */}
      <div className="w-60 flex-shrink-0 border-r border-white/[0.06] flex flex-col overflow-hidden">
        <div className="px-4 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">Chats</span>
          <div className="flex items-center gap-1.5">
            {selectMode && selectedChats.size > 0 && (
              <button onClick={() => {
                const updated = conversations.filter(c => !selectedChats.has(c.id));
                setConversations(updated);
                if (selectedChats.has(activeId || "")) setActiveId(updated[0]?.id || null);
                setSelectedChats(new Set());
                setSelectMode(false);
              }} className="text-[10px] text-red-400 border border-red-500/20 bg-red-500/10 px-2 py-1 rounded-lg">
                Delete {selectedChats.size}
              </button>
            )}
            <button onClick={() => { setSelectMode(!selectMode); setSelectedChats(new Set()); }}
              className="text-[10px] text-white/30 hover:text-white/60 px-2 py-1 rounded-lg border border-white/[0.06] hover:border-white/15 transition">
              {selectMode ? "Cancel" : "Select"}
            </button>
            {!selectMode && <button onClick={newConversation}
              className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition">
              <Plus size={12} className="text-white/50" />
            </button>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-white/20 text-xs">No conversations yet</p>
            </div>
          ) : (
            conversations.map(conv => (
              <div key={conv.id} onClick={() => {
                if (selectMode) {
                  const next = new Set(selectedChats);
                  next.has(conv.id) ? next.delete(conv.id) : next.add(conv.id);
                  setSelectedChats(next);
                } else {
                  setActiveId(conv.id);
                }
              }} className={`flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-white/[0.03] transition overflow-hidden ${activeId === conv.id && !selectMode ? "bg-white/[0.05]" : ""} ${selectedChats.has(conv.id) ? "bg-red-500/[0.05]" : ""}`}>
                {selectMode && (
                  <div className={`w-4 h-4 rounded flex-shrink-0 border flex items-center justify-center ${selectedChats.has(conv.id) ? "bg-red-500 border-red-500" : "border-white/20"}`}>
                    {selectedChats.has(conv.id) && <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate mb-0.5 ${activeId === conv.id && !selectMode ? "text-white/80" : "text-white/50"}`}>
                    {conv.title}
                  </p>
                  <p className="text-[10px] text-white/20">{formatDate(conv.createdAt)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between flex-shrink-0">
          <div>
            <h1 className="text-sm font-semibold tracking-tight">AI Analyst</h1>
            <p className="text-[10px] text-white/30">Powered by your business data</p>
          </div>
          <button onClick={newConversation}
            className="text-xs text-white/40 hover:text-white border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-lg transition">
            New chat
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6"/>
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-2 tracking-tight">Your AI COO</h2>
              <p className="text-sm text-white/30 mb-8 leading-relaxed">
                Ask anything about your business. I have full access to your emails, financials, and all connected data.
              </p>

              {/* Quick actions */}
              <div className="w-full space-y-2">
                {QUICK_ACTIONS.map(q => (
                  <button key={q} onClick={() => sendMessage(q)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-white/[0.06] hover:border-white/15 hover:bg-white/[0.03] transition group flex items-center justify-between">
                    <span className="text-sm text-white/50 group-hover:text-white/70 transition">{q}</span>
                    <ChevronRight size={14} className="text-white/20 group-hover:text-white/40 transition flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(message => (
                <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-1">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.6"/>
                      </svg>
                    </div>
                  )}

                  <div className={`max-w-[78%] ${message.role === "user" ? "items-end" : "items-start"} flex flex-col`}>
                    <div className={`rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-white text-black rounded-tr-md"
                        : "bg-white/[0.04] border border-white/[0.06] rounded-tl-md"
                    }`}>
                      {message.role === "user" ? (
                        <p className="text-sm font-medium leading-relaxed">{message.content}</p>
                      ) : message.pendingApproval ? (
                        <div className="space-y-3">
                          {message.content && <ReactMarkdown>{message.content}</ReactMarkdown>}
                          <div className="border border-amber-500/20 bg-amber-500/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Awaiting Your Approval</p>
                            </div>
                            <p className="text-sm font-semibold text-white mb-1">{message.pendingApproval.action}</p>
                            <p className="text-xs text-white/50 mb-3 leading-relaxed">{message.pendingApproval.details}</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleApprove(message)}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition">
                                ✓ Approve & Execute
                              </button>
                              <button onClick={() => handleReject(message)}
                                className="px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/40 text-xs hover:text-white/60 transition">
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : message.content ? (
                        <div className="prose prose-invert prose-sm max-w-none
                          prose-p:text-white/70 prose-p:leading-relaxed prose-p:text-sm prose-p:my-1.5
                          prose-strong:text-white prose-strong:font-semibold
                          prose-headings:text-white prose-headings:font-semibold prose-headings:text-sm
                          prose-li:text-white/70 prose-li:text-sm
                          prose-ul:my-2 prose-ol:my-2
                          prose-hr:border-white/10">
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-0.5">
                          <div className="flex gap-1">
                            {[0, 1, 2].map(i => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce"
                                style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                          </div>
                          <span className="text-xs text-white/30">Thinking...</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-white/20 mt-1 px-1">
                      {message.role === "assistant" ? "Jimmy AI · " : ""}{formatTime(message.timestamp)}
                    </p>
                  </div>

                  {message.role === "user" && (
                    <div className="w-7 h-7 rounded-full bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-[10px] font-semibold text-white/70">J</span>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex-shrink-0">
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask your AI COO anything..."
                rows={1}
                disabled={isLoading}
                className={cn(
                  "w-full bg-white/[0.03] border border-white/[0.08] rounded-2xl px-5 py-3.5 text-sm text-white placeholder-white/20 resize-none min-h-[50px] max-h-36 leading-relaxed focus:outline-none focus:border-white/20 transition-colors",
                  isLoading && "opacity-50 cursor-not-allowed"
                )}
                onInput={e => {
                  const el = e.currentTarget;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 144) + "px";
                }}
              />
            </div>
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="h-[50px] w-[50px] rounded-2xl bg-white disabled:opacity-20 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all hover:bg-white/90 active:scale-95">
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <Send size={15} className="text-black" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-white/15 mt-2 text-center">Shift+Enter for new line · Enter to send</p>
        </div>

      </div>
    </div>
  );
}
