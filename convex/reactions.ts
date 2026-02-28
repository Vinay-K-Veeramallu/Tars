import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

export const EMOJIS = ["👍", "❤", "😂", "😮", "😢"] as const;

/** Toggle reaction: add if not present, remove if already reacted with this emoji. */
export const toggle = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    if (!EMOJIS.includes(args.emoji as (typeof EMOJIS)[number])) return;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) throw new Error("User profile not found");
    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new Error("Message not found");
    const conv = await ctx.db.get(msg.conversationId);
    if (!conv || !conv.participantIds.includes(me._id)) throw new Error("Not in conversation");
    const existing = await ctx.db
      .query("reactions")
      .withIndex("by_message_emoji_user", (q) =>
        (q as any)
          .eq("messageId", args.messageId)
          .eq("emoji", args.emoji)
          .eq("userId", me._id)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.insert("reactions", {
        messageId: args.messageId,
        userId: me._id,
        emoji: args.emoji,
      });
    }
  },
});

/** Get reactions grouped by message for a conversation. */
export const listByConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return {};
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return {};
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.participantIds.includes(me._id)) return {};
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();
    const messageIds = messages.map((m) => m._id);
    const filtered: Doc<"reactions">[] = [];
    for (const messageId of messageIds) {
      const list = await ctx.db
        .query("reactions")
        .withIndex("by_message", (q) => q.eq("messageId", messageId))
        .collect();
      filtered.push(...list);
    }
    const byMessage: Record<
      string,
      { emoji: string; count: number; currentUser: boolean }[]
    > = {};
    for (const r of filtered) {
      const key = r.messageId;
      if (!byMessage[key]) byMessage[key] = [];
      const entry = byMessage[key].find((e) => e.emoji === r.emoji);
      const isCurrentUser = r.userId === me._id;
      if (entry) {
        entry.count += 1;
        entry.currentUser = entry.currentUser || isCurrentUser;
      } else {
        byMessage[key].push({
          emoji: r.emoji,
          count: 1,
          currentUser: isCurrentUser,
        });
      }
    }
    return byMessage;
  },
});
