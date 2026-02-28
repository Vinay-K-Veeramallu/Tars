import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Send a message. Updates unread for the other participant. Optional parentMessageId for replies. */
export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    parentMessageId: v.optional(v.id("messages")),
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
    if (args.parentMessageId) {
      const parent = await ctx.db.get(args.parentMessageId);
      if (!parent || parent.conversationId !== args.conversationId)
        throw new Error("Parent message not in this conversation");
    }
    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      senderId: me._id,
      content: args.content.trim(),
      isDeleted: false,
      createdAt: now,
      ...(args.parentMessageId && { parentMessageId: args.parentMessageId }),
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

/** List messages for a conversation (real-time), thread-ordered: root messages then their replies. */
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
    const raw = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
    const roots = raw.filter((m) => !m.parentMessageId);
    const byParent = new Map<
      import("./_generated/dataModel").Id<"messages">,
      typeof raw
    >();
    for (const m of raw) {
      if (m.parentMessageId) {
        const arr = byParent.get(m.parentMessageId) ?? [];
        arr.push(m);
        byParent.set(m.parentMessageId, arr);
      }
    }
    const ordered: typeof raw = [];
    for (const root of roots) {
      ordered.push(root);
      const replies = byParent.get(root._id) ?? [];
      replies.sort((a, b) => a.createdAt - b.createdAt);
      ordered.push(...replies);
    }
    return Promise.all(
      ordered.map(async (m) => {
        const sender = await ctx.db.get(m.senderId);
        const parent = m.parentMessageId
          ? await ctx.db.get(m.parentMessageId)
          : null;
        const parentSender = parent
          ? await ctx.db.get(parent.senderId)
          : null;
        return {
          ...m,
          sender,
          parentPreview: m.parentMessageId && parent
            ? {
                content: parent.content,
                senderName: parentSender?.name ?? "Deleted account",
              }
            : undefined,
        };
      })
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
