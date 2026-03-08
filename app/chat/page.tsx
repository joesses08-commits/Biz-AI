"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, RotateCcw } from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

const STARTER_QUESTIONS = [
  "Why is our profit margin so low?",
  "Which products should we prioritize?",
  "What are our biggest cost problems?",
  "How can we improve profitability this quarter?",
  "Which customers are most valuable to us?",
];

function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-end gap-3 animate-in">
      <div className="max-w-[75%]">
        <div className="bg-accent rounded-2xl rounded-tr-sm px-4 py-3">
          <p className="text-sm text-white leading-relaxed">{message.content}</p>
        </div>
        <p className="text-[10px] text-text-muted text-right mt-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 mt-1">
        <User size={13} className="text-accent" />
      </div>
    </div>
  );
}

function AssistantBubble({ message, isStreaming }: { message: Message; isStreaming?: boolean }) {
  return (
    <div className="flex gap-3 animate-in">
      <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-1">
        <Sparkles size={13} className="text-emerald-400" />
      </div>
      <div className="flex-1 max-w-[85%]">
        <div className="bg-bg-surface border border-bg-border rounded-2xl rounded-tl-sm px-5 py-4">
          {message.content ? (
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-text-primary prose-headings:font-semibold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-2
              prose-p:text-text-secondary prose-p:leading-relaxed prose-p:text-sm prose-p:my-1
              prose-li:text-text-secondary prose-li:text-sm prose-li:my-0.5
              prose-strong:text-text-primary prose-strong:font-semibold
              prose-ul:my-2 prose-ol:my-2
              prose-hr:border-bg-border">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
              <span className="text-xs text-text-muted">Analyzing your data...</span>
            </div>
          )}
          {isStreaming && message.content && (
            <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 animate-pulse" />
          )}
        </div>
        <p className="text-[10px] text-text-muted mt-1">
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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Chat failed");
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + chunk }
                : m
            )
          );
        }
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: `Sorry, something went wrong: ${err instanceof Error ? err.message : "Unknown error"}` }
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-bg-border bg-bg-surface flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
            <Sparkles size={14} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-text-primary" style={{ fontFamily: "var(--font-display)" }}>
              AI Analyst
            </h1>
            <p className="text-[10px] text-text-muted">Powered by your business data</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="btn-ghost text-xs gap-1.5"
          >
            <RotateCcw size={12} /> New chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center animate-in">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
              <Sparkles size={24} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-bold text-text-primary mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Ask your AI Business Analyst
            </h2>
            <p className="text-sm text-text-muted mb-8 max-w-sm">
              I have full access to your uploaded business data. Ask me anything about your revenue, costs, customers, or what to do next.
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-md">
              {STARTER_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left px-4 py-3 rounded-xl border border-bg-border hover:border-accent/40 hover:bg-bg-hover text-sm text-text-secondary hover:text-text-primary transition-all duration-150"
                >
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
                <AssistantBubble
                  key={message.id}
                  message={message}
                  isStreaming={streamingId === message.id}
                />
              )
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-bg-border bg-bg-surface flex-shrink-0">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a business question... (Enter to send)"
            rows={1}
            disabled={isLoading}
            className={cn(
              "input flex-1 resize-none min-h-[44px] max-h-32 py-3 leading-relaxed",
              isLoading && "opacity-50 cursor-not-allowed"
            )}
            style={{ height: "auto" }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 128) + "px";
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="btn-primary h-11 w-11 p-0 flex items-center justify-center flex-shrink-0"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Send size={15} />
            )}
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-2 text-center">
          Answers are based on your uploaded data · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
