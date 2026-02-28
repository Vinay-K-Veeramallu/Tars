"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { formatMessageTime } from "@/lib/formatTime";
import { UserButton } from "@clerk/nextjs";
import { Avatar } from "@/components/ui/Avatar";
import {
  ConversationListSkeleton,
  MessageListSkeleton,
  Skeleton,
} from "@/components/ui/Skeleton";
// Emoji set for reactions (must match convex/reactions.ts); do not import from Convex in the browser
const REACTION_EMOJIS = ["👍", "❤", "😂", "😮", "😢"] as const;

const DELETED_ACCOUNT_LABEL = "Deleted account";

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [ref, onOutside]);
}

type MessageWithSender = {
  _id: Id<"messages">;
  content: string;
  isDeleted: boolean;
  createdAt: number;
  sender: { name: string; imageUrl?: string; _id: Id<"users"> } | null;
  parentMessageId?: Id<"messages">;
  parentPreview?: { content: string; senderName: string };
};

const HEARTBEAT_INTERVAL_MS = 30_000;

export function ChatApp() {
  const { user } = useUser();
  const ensureProfile = useMutation(api.users.ensureProfile);
  const heartbeat = useMutation(api.presence.heartbeat);
  const me = useQuery(api.users.getMe);
  const [selectedConversationId, setSelectedConversationId] = useState<
    Id<"conversations"> | null
  >(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    ensureProfile({
      clerkId: user.id,
      name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "User",
      imageUrl: user.imageUrl,
      email: user.primaryEmailAddress?.emailAddress,
    }).catch(() => {});
  }, [user, ensureProfile]);

  useEffect(() => {
    if (!me) return;
    heartbeat();
    const t = setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [me, heartbeat]);

  const selectConversation = useCallback(
    (id: Id<"conversations"> | null) => {
      setSelectedConversationId(id);
      setMobileShowChat(!!id);
    },
    []
  );

  return (
    <div className="flex h-screen max-h-[100dvh] min-h-0 w-full max-w-[100vw] flex-col overflow-hidden bg-[var(--chat-bg)]">
      <header className="glass flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar src={me?.imageUrl} name={me?.name ?? "?"} size="md" className="ring-2 ring-[var(--border)]" />
          <span className="truncate text-base font-semibold text-[var(--foreground)]">
            {me?.name ?? "Loading…"}
          </span>
        </div>
        <div className="shrink-0">
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className={`glass flex min-w-0 w-full flex-col md:w-80 md:max-w-[320px] md:shrink-0 ${
            mobileShowChat ? "hidden md:flex" : "flex"
          }`}
        >
          <UserListAndConversations
            userSearch={userSearch}
            setUserSearch={setUserSearch}
            selectedConversationId={selectedConversationId}
            onSelectConversation={selectConversation}
          />
        </aside>

        <section
          className={`flex min-h-0 min-w-0 flex-1 flex-col ${
            !selectedConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedConversationId ? (
            <ChatPane
              conversationId={selectedConversationId}
              onBack={() => setMobileShowChat(false)}
            />
          ) : (
            <div className="glass-strong flex flex-1 flex-col items-center justify-center gap-6 rounded-2xl p-8 md:flex md:mx-4 md:max-w-md">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[var(--accent-muted)]/80 text-5xl shadow-[var(--shadow)] backdrop-blur-sm">
                👋
              </div>
              <div className="space-y-2 text-center">
                <p className="text-lg font-semibold text-[var(--foreground)]">No conversation selected</p>
                <p className="text-sm text-[var(--muted)]">
                  Choose a chat from the sidebar or start a new one.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function UserListAndConversations({
  userSearch,
  setUserSearch,
  selectedConversationId,
  onSelectConversation,
}: {
  userSearch: string;
  setUserSearch: (s: string) => void;
  selectedConversationId: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations"> | null) => void;
}) {
  const conversations = useQuery(api.conversations.list);
  const otherUsers = useQuery(api.users.listOthers, {
    search: userSearch || undefined,
  });
  const getOrCreate = useMutation(api.conversations.getOrCreate);
  const onlineUserIds = useQuery(api.presence.listOnlineUserIds) ?? [];

  const [startingWith, setStartingWith] = useState<Id<"users"> | null>(null);

  const handleStartChat = async (otherUserId: Id<"users">) => {
    if (startingWith) return;
    setStartingWith(otherUserId);
    try {
      const convId = await getOrCreate({ otherUserId });
      onSelectConversation(convId);
    } finally {
      setStartingWith(null);
    }
  };

  const isLoading = conversations === undefined;
  const hasConversations = Array.isArray(conversations) && conversations.length > 0;
  const hasUsers = Array.isArray(otherUsers) && otherUsers.length > 0;
  const hasSearch = userSearch.trim().length > 0;

  return (
    <>
      <div className="shrink-0 p-3">
        <input
          type="search"
          placeholder="Search users..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          className="glass-input min-h-[44px] w-full min-w-0 rounded-xl px-4 py-2.5 text-[var(--foreground)] placeholder-[var(--muted)] transition focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        />
      </div>

      {hasSearch && (
        <div className="flex flex-col overflow-auto border-b border-[var(--border)]">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
            Users
          </p>
          {otherUsers === undefined ? (
            <div className="flex justify-center py-6">
              <Skeleton className="h-8 w-8 rounded-full" circle />
            </div>
          ) : !hasUsers ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <span className="text-2xl opacity-60">🔍</span>
              <p className="text-sm text-[var(--muted)]">
                No users match &quot;{userSearch}&quot;
              </p>
            </div>
          ) : (
            <ul className="flex flex-col">
              {otherUsers.map((u) => (
                <li key={u._id}>
                  <button
                    type="button"
                    onClick={() => handleStartChat(u._id)}
                    disabled={!!startingWith}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-[var(--surface-hover)]/80 active:bg-[var(--surface-hover)]/80"
                  >
                    <Avatar src={u.imageUrl} name={u.name} size="md" />
                    <div className="relative min-w-0 flex-1">
                      <span className="font-medium text-[var(--foreground)]">
                        {u.name}
                      </span>
                      {onlineUserIds.includes(u._id) && (
                        <span
                          className="animate-pulse-soft ml-2 inline-block h-2.5 w-2.5 rounded-full bg-[var(--online)]"
                          title="Online"
                        />
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

        <div className="flex flex-1 flex-col overflow-auto">
        <p className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Conversations
        </p>
        {isLoading ? (
          <ConversationListSkeleton />
        ) : !hasConversations ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-muted)]/80 text-3xl text-[var(--accent)] shadow-[var(--shadow)] backdrop-blur-sm">
              💬
            </div>
            <div className="space-y-1">
              <p className="font-medium text-[var(--foreground)]">No conversations yet</p>
              <p className="max-w-[260px] text-sm text-[var(--muted)]">
                Search for a user above and tap their name to start a chat.
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col">
            {conversations!.map(
              ({ conversation, otherUser, lastMessage, unreadCount }, idx) => (
                <li
                  key={conversation._id}
                  className={`animate-slide-up opacity-0 ${idx < 10 ? ["stagger-1", "stagger-2", "stagger-3", "stagger-4", "stagger-5"][idx % 5] : ""}`}
                  style={{ animationFillMode: "forwards" }}
                >
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation._id)}
                    className={`flex min-h-[72px] w-full flex-col justify-center gap-0.5 rounded-xl px-4 py-3 text-left transition ${
                      selectedConversationId === conversation._id
                        ? "border border-[var(--border-strong)] bg-[var(--accent-soft)]/90 shadow-[var(--shadow-sm)] backdrop-blur-sm"
                        : "hover:bg-[var(--surface-hover)]/70 active:bg-[var(--surface-hover)]/80"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={otherUser?.imageUrl}
                        name={otherUser?.name ?? DELETED_ACCOUNT_LABEL}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`truncate font-semibold ${
                              otherUser
                                ? "text-[var(--foreground)]"
                                : "italic text-[var(--muted)]"
                            }`}
                          >
                            {otherUser?.name ?? DELETED_ACCOUNT_LABEL}
                          </span>
                          {otherUser &&
                            onlineUserIds.includes(otherUser._id) && (
                              <span
                                className="animate-pulse-soft h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--online)]"
                                title="Online"
                              />
                            )}
                        </div>
                        {lastMessage && (
                          <p className="truncate text-sm text-[var(--muted)]">
                            {lastMessage.isDeleted
                              ? "This message was deleted"
                              : lastMessage.content}
                          </p>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-[var(--accent)] px-2 text-xs font-bold text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )
            )}
          </ul>
        )}
      </div>
    </>
  );
}

function ChatPane({
  conversationId,
  onBack,
}: {
  conversationId: Id<"conversations">;
  onBack?: () => void;
}) {
  const convData = useQuery(api.conversations.get, { conversationId });
  const messages = useQuery(api.messages.list, { conversationId });
  const typingUsers = useQuery(api.typing.getTyping, { conversationId });
  const reactionsMap = useQuery(api.reactions.listByConversation, {
    conversationId,
  }) ?? {};
  const clearUnread = useMutation(api.unreadCounts.clear);
  const sendMessage = useMutation(api.messages.send);
  const setTyping = useMutation(api.typing.setTyping);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{
    messageId: Id<"messages">;
    content: string;
    senderName: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLLIElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageCountRef = useRef(0);
  const messageCountWhenScrolledUpRef = useRef(0);
  const prevNearBottomRef = useRef(true);
  messageCountRef.current = messages?.length ?? 0;

  const onReply = useCallback((message: MessageWithSender) => {
    setReplyingTo({
      messageId: message._id,
      content: message.content,
      senderName: message.sender?.name ?? DELETED_ACCOUNT_LABEL,
    });
  }, []);

  useEffect(() => {
    clearUnread({ conversationId });
  }, [conversationId, clearUnread]);

  const notifyTyping = useCallback(() => {
    setTyping({ conversationId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTyping({ conversationId, isTyping: false });
      typingTimeoutRef.current = null;
    }, 2000);
  }, [conversationId, setTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    setSendError(null);
    notifyTyping();
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setSending(true);
    setSendError(null);
    setTyping({ conversationId, isTyping: false });
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    try {
      await sendMessage({
        conversationId,
        content: text,
        ...(replyingTo && { parentMessageId: replyingTo.messageId }),
      });
      setReplyingTo(null);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const prevLengthRef = useRef(0);
  useEffect(() => {
    const len = messages?.length ?? 0;
    if (len > prevLengthRef.current && !userScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevLengthRef.current = len;
  }, [messages?.length, userScrolledUp]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 80;
    if (nearBottom) {
      setUserScrolledUp(false);
      messageCountWhenScrolledUpRef.current = messageCountRef.current;
    } else {
      if (prevNearBottomRef.current) {
        messageCountWhenScrolledUpRef.current = messageCountRef.current;
      }
      setUserScrolledUp(true);
    }
    prevNearBottomRef.current = nearBottom;
  }, []);

  const scrollToBottom = useCallback(() => {
    setUserScrolledUp(false);
    prevNearBottomRef.current = true;
    messageCountWhenScrolledUpRef.current = messageCountRef.current;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (!convData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
      </div>
    );
  }

  const { otherUser } = convData;
  const isLoadingMessages = messages === undefined;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="glass flex shrink-0 items-center gap-3 px-4 py-3">
        {onBack && (
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-hover)]/80 hover:text-[var(--foreground)] active:scale-95 md:hidden"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
        <Avatar
          src={otherUser?.imageUrl}
          name={otherUser?.name ?? DELETED_ACCOUNT_LABEL}
          size="md"
          className="ring-2 ring-[var(--border)]"
        />
        <span
          className={`min-w-0 truncate text-base font-semibold ${
            otherUser
              ? "text-[var(--foreground)]"
              : "italic text-[var(--muted)]"
          }`}
        >
          {otherUser?.name ?? DELETED_ACCOUNT_LABEL}
        </span>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="chat-messages-bg min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-5"
      >
        {userScrolledUp &&
          (messages?.length ?? 0) > messageCountWhenScrolledUpRef.current && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="glass-strong sticky top-2 left-1/2 z-10 -translate-x-1/2 rounded-full border-0 bg-[var(--accent)]/95 px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)] backdrop-blur-md transition hover:bg-[var(--accent-hover)] active:scale-[0.98]"
            >
              ↓ New messages
            </button>
          )}
        {isLoadingMessages ? (
          <MessageListSkeleton />
        ) : !messages?.length ? (
          <div className="glass-strong flex flex-col items-center justify-center gap-6 rounded-2xl py-16 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--accent-muted)]/80 text-4xl shadow-[var(--shadow)] backdrop-blur-sm">
              👋
            </div>
            <div className="space-y-2">
              <p className="text-lg font-semibold text-[var(--foreground)]">No messages yet</p>
              <p className="text-sm text-[var(--muted)]">Say hello to get the conversation started.</p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((m: MessageWithSender, idx) => (
              <MessageBubble
                key={m._id}
                message={m}
                reactionsForMessage={reactionsMap[m._id]}
                onReply={onReply}
                className="animate-slide-up opacity-0"
                style={{
                  animationDelay: `${Math.min(idx * 0.03, 0.3)}s`,
                  animationFillMode: "forwards",
                }}
              />
            ))}
            <li ref={messagesEndRef} aria-hidden className="list-none" />
          </ul>
        )}
        {Array.isArray(typingUsers) && typingUsers.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
            <span className="flex gap-1">
              <span className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              <span
                className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                style={{ animationDelay: "0.2s" }}
              />
              <span
                className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                style={{ animationDelay: "0.4s" }}
              />
            </span>
            {typingUsers.length === 1
              ? `${typingUsers[0]?.name ?? "Someone"} is typing...`
              : "Typing..."}
          </div>
        )}
      </div>

      <div className="glass shrink-0 p-4">
        {sendError && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200/60 bg-red-500/10 px-4 py-2.5 text-sm text-red-600 backdrop-blur-sm dark:border-red-900/40 dark:bg-red-500/15 dark:text-red-400">
            <span className="min-w-0 flex-1">{sendError}</span>
            <button
              type="button"
              onClick={() => setSendError(null)}
              className="shrink-0 font-medium underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {replyingTo && (
          <div className="glass-input mb-3 flex items-center gap-2 rounded-xl px-4 py-2.5">
            <span className="min-w-0 flex-1 truncate text-xs text-[var(--muted)]">
              Replying to <strong className="text-[var(--foreground)]">{replyingTo.senderName}</strong>: “
              {replyingTo.content.slice(0, 60)}
              {replyingTo.content.length > 60 ? "…" : ""}”
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface-hover)]/80 hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
          </div>
        )}
        <div className="glass-input flex min-w-0 gap-3 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-[var(--accent)]/30">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && handleSend()
            }
            placeholder="Type a message..."
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border-0 bg-transparent px-4 py-2.5 text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-0"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="min-h-[44px] shrink-0 rounded-xl bg-[var(--accent)]/90 px-5 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow)] backdrop-blur-sm transition hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-md)] disabled:opacity-50 active:scale-[0.98]"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ReactionEntry = { emoji: string; count: number; currentUser: boolean };

function MessageBubble({
  message,
  reactionsForMessage = [],
  onReply,
  className,
  style,
}: {
  message: MessageWithSender;
  reactionsForMessage?: ReactionEntry[];
  onReply?: (message: MessageWithSender) => void;
  className?: string;
  style?: React.CSSProperties;
}) {
  const removeMessage = useMutation(api.messages.remove);
  const toggleReaction = useMutation(api.reactions.toggle);
  const me = useQuery(api.users.getMe);
  const isMe = me && message.sender?._id === me._id;
  const [reactOpen, setReactOpen] = useState(false);
  const reactRef = useRef<HTMLDivElement>(null);
  useClickOutside(reactRef, () => setReactOpen(false));

  const reactionCount = (emoji: string) =>
    reactionsForMessage.find((r) => r.emoji === emoji)?.count ?? 0;
  const hasReacted = (emoji: string) =>
    reactionsForMessage.find((r) => r.emoji === emoji)?.currentUser ?? false;
  const pills = reactionsForMessage.filter((r) => r.count > 0);

  return (
    <li
      className={`flex min-w-0 gap-2 ${isMe ? "flex-row-reverse" : ""} ${
        message.parentMessageId ? "pl-4 sm:pl-6" : ""
      } ${className ?? ""}`}
      style={style}
    >
      {!isMe && !message.parentMessageId && (
        <div className="self-end">
          <Avatar
            src={message.sender?.imageUrl}
            name={message.sender?.name ?? "?"}
            size="sm"
          />
        </div>
      )}
      {!isMe && message.parentMessageId && <div className="w-8 shrink-0 sm:w-10" />}
      <div
        className={`max-w-[85%] min-w-0 rounded-2xl px-4 py-3 sm:max-w-[75%] ${
          message.parentMessageId
            ? "border-l-2 border-[var(--accent)]/40"
            : ""
        } ${
          isMe
            ? "rounded-br-md bg-[var(--accent)]/95 text-white shadow-[var(--shadow)] backdrop-blur-sm"
            : "glass rounded-bl-md text-[var(--foreground)]"
        }`}
      >
        {message.parentPreview && (
          <p
            className={`mb-1 truncate rounded px-2 py-0.5 text-xs ${
              isMe ? "bg-white/20 text-white/90" : "bg-[var(--surface-hover)] text-[var(--muted)]"
            }`}
          >
            Replying to {message.parentPreview.senderName}: “
            {message.parentPreview.content.slice(0, 50)}
            {message.parentPreview.content.length > 50 ? "…" : ""}”
          </p>
        )}
        {!isMe && !message.parentMessageId && (
          <p
            className={`mb-0.5 text-xs font-semibold ${
              message.sender
                ? "text-[var(--accent)]"
                : "italic text-[var(--muted)]"
            }`}
          >
            {message.sender?.name ?? DELETED_ACCOUNT_LABEL}
          </p>
        )}
        {message.isDeleted ? (
          <p className="italic text-[var(--muted)]">
            This message was deleted
          </p>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs opacity-80">
            {formatMessageTime(message.createdAt)}
          </span>
          <div className="flex items-center gap-1">
            {onReply && !message.isDeleted && (
              <button
                type="button"
                onClick={() => onReply(message)}
                className="min-h-[32px] rounded px-2 text-xs opacity-70 transition hover:opacity-100"
                title="Reply"
              >
                Reply
              </button>
            )}
            {isMe && !message.isDeleted && (
              <button
                type="button"
                onClick={() => removeMessage({ messageId: message._id })}
                className="min-h-[32px] min-w-[44px] text-xs opacity-70 transition hover:opacity-100"
                title="Delete message"
              >
                Delete
              </button>
            )}
          </div>
        </div>
        {/* React: single trigger + popover; show only pills with count > 0 */}
        <div className="relative mt-2 flex flex-wrap items-center gap-1" ref={reactRef}>
          {pills.length > 0 && (
            <span className="flex flex-wrap items-center gap-1">
              {pills.map((r) => {
                const reacted = r.currentUser;
                return (
                  <button
                    key={r.emoji}
                    type="button"
                    onClick={() =>
                      toggleReaction({ messageId: message._id, emoji: r.emoji })
                    }
                    className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-sm transition ${
                      isMe
                        ? reacted
                          ? "bg-white/20 ring-1 ring-white/50"
                          : "hover:bg-white/10"
                        : reacted
                          ? "bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/50"
                          : "hover:bg-[var(--surface-hover)]"
                    }`}
                    title={`${r.emoji} ${r.count}`}
                  >
                    <span className="min-w-[1.25rem] text-base">
                      {r.emoji}
                    </span>
                    <span className="min-w-[1rem] text-xs font-medium text-[var(--foreground)]">
                      {r.count}
                    </span>
                  </button>
                );
              })}
            </span>
          )}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => setReactOpen((o) => !o)}
              className="rounded-full p-1 text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
              title="Add reaction"
              aria-label="Add reaction"
            >
              <span className="text-base">😊</span>
            </button>
            {reactOpen && (
              <div className="glass-strong absolute bottom-full left-0 z-20 mb-1 flex gap-0.5 rounded-xl p-1.5">
                {REACTION_EMOJIS.map((emoji) => {
                  const reacted = hasReacted(emoji);
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        toggleReaction({ messageId: message._id, emoji });
                        setReactOpen(false);
                      }}
                      className={`rounded-lg p-1.5 text-lg transition ${
                        reacted
                          ? "bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]/50"
                          : "hover:bg-[var(--surface-hover)]"
                      }`}
                      title={`React with ${emoji}`}
                    >
                      <span className="text-base">
                        {emoji}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
