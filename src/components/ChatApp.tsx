"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type MessageWithSender = {
  _id: Id<"messages">;
  content: string;
  isDeleted: boolean;
  createdAt: number;
  sender: { name: string; imageUrl?: string; _id: Id<"users"> } | null;
};
import { formatMessageTime } from "@/lib/formatTime";
import { UserButton } from "@clerk/nextjs";

const HEARTBEAT_INTERVAL_MS = 30_000;
const TYPING_DEBOUNCE_MS = 300;

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

  // Ensure Convex profile exists when Clerk user is loaded
  useEffect(() => {
    if (!user) return;
    ensureProfile({
      clerkId: user.id,
      name: user.fullName ?? user.primaryEmailAddress?.emailAddress ?? "User",
      imageUrl: user.imageUrl,
      email: user.primaryEmailAddress?.emailAddress,
    }).catch(() => {});
  }, [user, ensureProfile]);

  // Presence heartbeat
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
    <div className="flex h-screen max-h-[100dvh] min-h-0 w-full max-w-[100vw] flex-col overflow-hidden">
      {/* Header: user info + sign out */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {me?.imageUrl ? (
            <img
              src={me.imageUrl}
              alt={me.name}
              className="h-8 w-8 shrink-0 rounded-full"
            />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium text-zinc-600 dark:bg-zinc-600 dark:text-zinc-200">
              {me?.name?.charAt(0) ?? "?"}
            </div>
          )}
          <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:text-base">
            {me?.name ?? "Loading…"}
          </span>
        </div>
        <div className="shrink-0">
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Sidebar: visible on desktop; on mobile show when chat is not open */}
        <aside
          className={`flex min-w-0 w-full flex-col border-r border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 md:w-80 md:max-w-[320px] md:shrink-0 ${
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

        {/* Chat area: on mobile full screen when conversation selected */}
        <section
          className={`flex min-w-0 flex-1 flex-col bg-zinc-50 dark:bg-zinc-900 ${
            !selectedConversationId ? "hidden md:flex" : "flex"
          }`}
        >
          {selectedConversationId ? (
            <>
              <ChatPane
                conversationId={selectedConversationId}
                onBack={() => setMobileShowChat(false)}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 md:flex">
              <p className="text-center text-zinc-500 dark:text-zinc-400">
                Select a conversation or start a new chat from the list.
              </p>
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
  const otherUsers = useQuery(api.users.listOthers, { search: userSearch || undefined });
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
      {/* Search users */}
      <div className="shrink-0 border-b border-zinc-200 p-2 dark:border-zinc-700">
        <input
          type="search"
          placeholder="Search users by name..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          className="min-h-[44px] w-full min-w-0 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-base placeholder-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:placeholder-zinc-400 sm:text-sm"
        />
      </div>

      {/* User list (when searching) */}
      {hasSearch && (
        <div className="flex flex-col overflow-auto border-b border-zinc-200 dark:border-zinc-700">
          <p className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Users
          </p>
          {otherUsers === undefined ? (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
            </div>
          ) : !hasUsers ? (
            <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
              No users match &quot;{userSearch}&quot;
            </p>
          ) : (
            <ul className="flex flex-col">
              {otherUsers.map((u) => (
                <li key={u._id}>
                    <button
                    type="button"
                    onClick={() => handleStartChat(u._id)}
                    disabled={!!startingWith}
                    className="flex min-h-[44px] w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-zinc-100 active:bg-zinc-100 dark:hover:bg-zinc-700 dark:active:bg-zinc-700"
                  >
                    {u.imageUrl ? (
                      <img src={u.imageUrl} alt="" className="h-9 w-9 rounded-full" />
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium dark:bg-zinc-600">
                        {u.name.charAt(0)}
                      </div>
                    )}
                    <div className="relative flex-1">
                      <span className="font-medium text-zinc-800 dark:text-zinc-100">
                        {u.name}
                      </span>
                      {onlineUserIds.includes(u._id) && (
                        <span
                          className="ml-2 inline-block h-2 w-2 rounded-full bg-green-500"
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

      {/* Conversation list */}
      <div className="flex flex-1 flex-col overflow-auto">
        <p className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Conversations
        </p>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          </div>
        ) : !hasConversations ? (
          <p className="px-3 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            No conversations yet. Search for a user above and click to start a chat.
          </p>
        ) : (
          <ul className="flex flex-col">
            {conversations!.map(({ conversation, otherUser, lastMessage, unreadCount }) => (
              <li key={conversation._id}>
                <button
                  type="button"
                  onClick={() => onSelectConversation(conversation._id)}
                  className={`flex min-h-[52px] w-full flex-col justify-center gap-0.5 px-3 py-2.5 text-left hover:bg-zinc-100 active:bg-zinc-100 dark:hover:bg-zinc-700 dark:active:bg-zinc-700 ${
                    selectedConversationId === conversation._id
                      ? "bg-zinc-100 dark:bg-zinc-700"
                      : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {otherUser?.imageUrl ? (
                      <img
                        src={otherUser.imageUrl}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full"
                      />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium dark:bg-zinc-600">
                        {otherUser?.name?.charAt(0) ?? "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium text-zinc-800 dark:text-zinc-100">
                          {otherUser?.name ?? "Unknown"}
                        </span>
                        {otherUser && onlineUserIds.includes(otherUser._id) && (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-green-500"
                            title="Online"
                          />
                        )}
                      </div>
                      {lastMessage && (
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {lastMessage.isDeleted
                            ? "This message was deleted"
                            : lastMessage.content}
                        </p>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500 px-1.5 text-xs font-medium text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            ))}
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
  const clearUnread = useMutation(api.unreadCounts.clear);
  const sendMessage = useMutation(api.messages.send);
  const setTyping = useMutation(api.typing.setTyping);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear unread when opening this conversation
  useEffect(() => {
    clearUnread({ conversationId });
  }, [conversationId, clearUnread]);

  // Typing indicator: send when user types, clear after send or 2s idle
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
      await sendMessage({ conversationId, content: text });
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  // Smart scroll: scroll to bottom when new messages arrive; if user scrolled up, show "New messages" button
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
    setUserScrolledUp(!nearBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    setUserScrolledUp(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  if (!convData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
      </div>
    );
  }

  const { otherUser } = convData;
  const isLoadingMessages = messages === undefined;

  return (
    <div className="flex flex-1 flex-col">
      {/* Chat header with back on mobile */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 sm:px-4">
        {onBack && (
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 active:bg-zinc-100 md:hidden dark:text-zinc-300 dark:hover:bg-zinc-700 dark:active:bg-zinc-700"
            onClick={onBack}
            aria-label="Back to conversations"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        {otherUser?.imageUrl ? (
          <img src={otherUser.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-sm font-medium dark:bg-zinc-600">
            {otherUser?.name?.charAt(0) ?? "?"}
          </div>
        )}
        <span className="min-w-0 truncate text-sm font-medium text-zinc-800 dark:text-zinc-100 sm:text-base">
          {otherUser?.name ?? "Unknown"}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4"
      >
        {userScrolledUp && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="sticky top-0 left-1/2 z-10 min-h-[44px] -translate-x-1/2 rounded-full bg-zinc-700 px-4 py-2.5 text-sm text-white shadow hover:bg-zinc-600 active:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:active:bg-zinc-500"
          >
            ↓ New messages
          </button>
        )}
        {isLoadingMessages ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
          </div>
        ) : !messages?.length ? (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No messages yet. Say hello!
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {messages.map((m: MessageWithSender) => (
              <MessageBubble key={m._id} message={m} />
            ))}
            <div ref={messagesEndRef} />
          </ul>
        )}
        {Array.isArray(typingUsers) && typingUsers.length > 0 && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {typingUsers.length === 1
              ? `${typingUsers[0]?.name ?? "Someone"} is typing...`
              : "Several people are typing..."}
          </p>
        )}
      </div>

      {/* Input + send error */}
      <div className="shrink-0 border-t border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800 sm:p-4">
        {sendError && (
          <p className="mb-2 text-sm text-red-600 dark:text-red-400">
            {sendError}{" "}
            <button
              type="button"
              onClick={() => setSendError(null)}
              className="min-h-[44px] min-w-[44px] underline"
            >
              Dismiss
            </button>
          </p>
        )}
        <div className="flex min-w-0 gap-2">
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-base focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-600 dark:bg-zinc-700 dark:placeholder-zinc-400 sm:text-sm"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="min-h-[44px] shrink-0 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: MessageWithSender }) {
  const removeMessage = useMutation(api.messages.remove);
  const me = useQuery(api.users.getMe);
  const isMe = me && message.sender?._id === me._id;

  return (
    <li className={`flex min-w-0 gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
      {!isMe && message.sender?.imageUrl && (
        <img
          src={message.sender.imageUrl}
          alt=""
          className="h-6 w-6 shrink-0 rounded-full self-end sm:h-6"
        />
      )}
      {!isMe && !message.sender?.imageUrl && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-300 text-xs dark:bg-zinc-600 self-end">
          {message.sender?.name?.charAt(0) ?? "?"}
        </div>
      )}
      <div
        className={`max-w-[85%] min-w-0 rounded-lg px-3 py-2 sm:max-w-[75%] ${
          isMe
            ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
            : "bg-white text-zinc-800 shadow dark:bg-zinc-700 dark:text-zinc-100"
        }`}
      >
        {!isMe && message.sender && (
          <p className="mb-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {message.sender.name}
          </p>
        )}
        {message.isDeleted ? (
          <p className="italic text-zinc-500 dark:text-zinc-400">
            This message was deleted
          </p>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatMessageTime(message.createdAt)}
          </span>
          {isMe && !message.isDeleted && (
            <button
              type="button"
              onClick={() => removeMessage({ messageId: message._id })}
              className="min-h-[32px] min-w-[44px] text-xs text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
              title="Delete message"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
