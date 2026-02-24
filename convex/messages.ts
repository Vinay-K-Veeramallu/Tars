import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Send a message. Updates unread for the other participant. */
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) throw new Error("User profile not found");
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.participantIds.includes(me._id)) throw new Error("Conversation not found");
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: me._id,
      content: args.content.trim(),
      isDeleted: false,
      createdAt: now,
    });
    const otherId = conv.participantIds.find((id: import("./_generated/dataModel").Id<"users">) => id !== me._id);
    if (otherId) {
      const existing = await ctx.db
        .query("unreadCounts")
        .withIndex("by_user_conversation", (q) =>
          (q as any).eq("userId", otherId).eq("conversationId", args.conversationId)
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, { count: existing.count + 1 });
      } else {
        await ctx.db.insert("unreadCounts", {
          userId: otherId,
          conversationId: args.conversationId,
          count: 1,
        });
      }
    }
    return messageId;
  },
});

/** List messages for a conversation (real-time). */
export const list = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return [];
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.participantIds.includes(me._id)) return [];
    const list = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
    return Promise.all(
      list.map(async (m) => ({
        ...m,
        sender: await ctx.db.get(m.senderId),
      }))
    );
  },
});

/** Soft-delete own message. */
export const remove = mutation({
  args: { messageId: v.id("messages") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) throw new Error("User profile not found");
    const msg = await ctx.db.get(args.messageId);
    if (!msg || msg.senderId !== me._id) throw new Error("Cannot delete this message");
    await ctx.db.patch(args.messageId, { isDeleted: true, deletedAt: Date.now() });
  },
});
