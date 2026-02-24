import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Clear unread count when user opens a conversation. */
export const clear = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return;
    const row = await ctx.db
      .query("unreadCounts")
      .withIndex("by_user_conversation", (q) =>
        (q as any).eq("userId", me._id).eq("conversationId", args.conversationId)
      )
      .unique();
    if (row) {
      await ctx.db.patch(row._id, { count: 0, lastReadAt: Date.now() });
    }
  },
});

/** Get unread count for a conversation (for current user). */
export const get = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return 0;
    const row = await ctx.db
      .query("unreadCounts")
      .withIndex("by_user_conversation", (q) =>
        (q as any).eq("userId", me._id).eq("conversationId", args.conversationId)
      )
      .unique();
    return row?.count ?? 0;
  },
});
