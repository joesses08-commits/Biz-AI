"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, RotateCcw, Zap } from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const STARTER_QUESTIONS = [
  "What's the most important thing I should focus on today?",
  "What does my financial position look like right now?",
  "Who are my most valuable customers?",
  "What are my biggest cost problems?",
  "Are there any urgent issues I should know about?",
  "How can I improve profitability this quarter?",
];

function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-end gap-3">
      <div className="max-w-[72%]">
        <div className="bg-white text-black rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
          <p className="text-sm leading-relaxed font-medium">{message.content}</p>
        </div>
        <p className="text-[10px] text-text-muted text-right mt-1.5 pr-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <div className="w-7 h-7 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 mt-1">
        <User size={12} className="text-white/70" />
      </div>
    </div>
  );
}

function AssistantBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 mt-1">
        <Zap size={11} className="text-accent" fill="currentColor" />
      </div>
      <div className="flex-1 max-w-[82%]">
        <div className="bg-bg-surface border border-bg-border rounded-2xl rounded-tl-md px-5 py-4 shadow-sm">
          {message.content ? (
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-text-primary prose-headings:font-semibold prose-headings:text-sm prose-headings:mt-3 prose-headings:mb-1.5
              prose-p:text-text-secondary prose-p:leading-relaxed prose-p:text-sm prose-p:my-1
              prose-li:text-text-secondary prose-li:text-sm prose-li:my-0.5
              prose-strong:text-text-primary prose-strong:font-semibold
              prose-ul:my-2 prose-ol:my-2
              prose-hr:border-bg-border">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 py-0.5">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-xs text-text-muted">Analyzing your data...</span>
            </div>
          )}
          {isStreaming && message.content && (
            <span className="inline-block w-0.5 h-3.5 bg-accent ml-0.5 animate-pulse" />
          )}
        </div>
        <p className="text-[10px] text-text-muted mt-1.5 pl-1">
          BizAI · {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

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

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);
    setStreamingId(assistantMsg.id);

    try {
      const history = [...messages, userMsg].map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) throw new Error("Chat failed");
      const data = await res.json();

      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: data.message || data.response || "No response" }
            : m
        )
      );
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: "Something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      setStreamingId(null);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-bg-base">
      {/* Header */}
      <div className="px-6 py-4 border-b border-bg-border bg-bg-surface/80 backdrop-blur-sm flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center">
            <Zap size={14} className="text-accent" fill="currentColor" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              AI Analyst
            </h1>
            <p className="text-[10px] text-text-muted">Powered by your business data</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} className="btn-ghost text-xs gap-1.5 h-8">
            <RotateCcw size={11} /> New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-6 shadow-lg shadow-accent/5">
              <Zap size={28} className="text-accent" fill="currentColor" />
            </div>
            <h2 className="text-2xl font-bold text-text-primary mb-2 tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              Your AI COO
            </h2>
            <p className="text-sm text-text-muted mb-10 leading-relaxed">
              Ask anything about your business. I have access to your financials, emails, and all connected data.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left px-4 py-3 rounded-xl border border-bg-border hover:border-accent/30 hover:bg-white/3 text-sm text-text-secondary hover:text-text-primary transition-all duration-150 group"
                >
                  <span className="text-accent/50 group-hover:text-accent mr-2 transition-colors">→</span>
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) =>
              message.role === "user" ? (
                <UserBubble key={message.id} message={message} />
              ) : (
                <AssistantBubble key={message.id} message={message} isStreaming={streamingId === message.id} />
              )
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-bg-border bg-bg-surface/80 backdrop-blur-sm flex-shrink-0">
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
                "w-full bg-bg-elevated border border-bg-border rounded-2xl px-5 py-3.5 text-sm text-text-primary placeholder:text-text-muted resize-none min-h-[50px] max-h-36 leading-relaxed focus:outline-none focus:border-accent/40 transition-colors",
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
            className="h-[50px] w-[50px] rounded-2xl bg-accent hover:bg-accent-hover disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0 transition-all duration-150 active:scale-95 shadow-lg shadow-accent/20"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={15} className="text-white" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-2 text-center">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  );
}
