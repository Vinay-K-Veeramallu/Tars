import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

type UserId = Id<"users">;

function sortedParticipantIds(
  a: Id<"users">,
  b: Id<"users">
): [Id<"users">, Id<"users">] {
  return a < b ? [a, b] : [b, a];
}

/** Get or create a conversation between current user and another user. */
export const getOrCreate = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) throw new Error("User profile not found");
    const participantIds = sortedParticipantIds(me._id, args.otherUserId);
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_participants", (q) =>
        q.eq("participantIds", participantIds)
      )
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("conversations", { participantIds });
  },
});

/** List conversations for current user with latest message preview. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return [];

    const all = await ctx.db.query("conversations").collect();
    const mine = all.filter((c) => c.participantIds.includes(me._id));
    const result = await Promise.all(
      mine.map(async (conv) => {
        const otherId = conv.participantIds.find((id: UserId) => id !== me._id)!;
        const other = await ctx.db.get(otherId);
        const lastMessage = await ctx.db
          .query("messages")
          .withIndex("by_conversation_created", (q) => q.eq("conversationId", conv._id))
          .order("desc")
          .first();
        const unread = await ctx.db
          .query("unreadCounts")
          .withIndex("by_user_conversation", (q) =>
            (q as any).eq("userId", me._id).eq("conversationId", conv._id)
          )
          .unique();
        return {
          conversation: conv,
          otherUser: other,
          lastMessage: lastMessage
            ? {
                ...lastMessage,
                sender: await ctx.db.get(lastMessage.senderId),
              }
            : null,
          unreadCount: unread?.count ?? 0,
        };
      })
    );
    result.sort((a, b) => {
      const tA = a.lastMessage?.createdAt ?? 0;
      const tB = b.lastMessage?.createdAt ?? 0;
      return tB - tA;
    });
    return result;
  },
});

/** Get a single conversation by id (for current user). */
export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return null;
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.participantIds.includes(me._id)) return null;
    const otherId = conv.participantIds.find((id: UserId) => id !== me._id)!;
    const other = await ctx.db.get(otherId);
    return { conversation: conv, otherUser: other };
  },
});
