import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// User profiles stored in Convex (synced from Clerk)
const users = defineTable({
  clerkId: v.string(),
  name: v.string(),
  imageUrl: v.optional(v.string()),
  email: v.optional(v.string()),
})
  .index("by_clerk_id", ["clerkId"])
  .index("by_name", ["name"]);

// Presence: who is online (updated by client heartbeat)
const presence = defineTable({
  userId: v.id("users"),
  lastSeen: v.number(),
})
  .index("by_user", ["userId"])
  .index("by_last_seen", ["lastSeen"]);

// Typing indicator per conversation
const typing = defineTable({
  conversationId: v.id("conversations"),
  userId: v.id("users"),
  updatedAt: v.number(),
})
  .index("by_conversation", ["conversationId"]);

// One-on-one conversations (participants are the two user IDs sorted)
const conversations = defineTable({
  participantIds: v.array(v.id("users")),
})
  .index("by_participants", ["participantIds"]);

// Messages (soft delete: isDeleted, deletedAt; optional parent for reply threads)
const messages = defineTable({
  conversationId: v.id("conversations"),
  senderId: v.id("users"),
  content: v.string(),
  isDeleted: v.boolean(),
  deletedAt: v.optional(v.number()),
  createdAt: v.number(),
  parentMessageId: v.optional(v.id("messages")),
})
  .index("by_conversation", ["conversationId"])
  .index("by_conversation_created", ["conversationId", "createdAt"]);

// Unread counts per user per conversation (cleared when user opens conversation)
const unreadCounts = defineTable({
  userId: v.id("users"),
  conversationId: v.id("conversations"),
  count: v.number(),
  lastReadAt: v.optional(v.number()),
})
  .index("by_user_conversation", ["userId", "conversationId"])
  .index("by_user", ["userId"]);

// Message reactions: one row per (messageId, userId, emoji). Click same again = remove.
const reactions = defineTable({
  messageId: v.id("messages"),
  userId: v.id("users"),
  emoji: v.string(), // one of 👍 ❤ 😂 😮 😢
})
  .index("by_message", ["messageId"])
  .index("by_message_emoji_user", ["messageId", "emoji", "userId"]);

export default defineSchema({
  users,
  presence,
  typing,
  conversations,
  messages,
  unreadCounts,
  reactions,
});
