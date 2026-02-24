import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const TYPING_TIMEOUT_MS = 2000;

/** Set typing state for current user in a conversation. */
export const setTyping = mutation({
  args: {
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return;
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || !conv.participantIds.includes(me._id)) return;
    const now = Date.now();
    const existing = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    const myEntry = existing.find((e) => e.userId === me._id);
    if (args.isTyping) {
      if (myEntry) {
        await ctx.db.patch(myEntry._id, { updatedAt: now });
      } else {
        await ctx.db.insert("typing", {
          conversationId: args.conversationId,
          userId: me._id,
          updatedAt: now,
        });
      }
    } else if (myEntry) {
      await ctx.db.delete(myEntry._id);
    }
  },
});

/** Who is typing in this conversation (excluding current user). Stale entries (> TYPING_TIMEOUT_MS) are ignored. */
export const getTyping = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return [];
    const cutoff = Date.now() - TYPING_TIMEOUT_MS;
    const entries = await ctx.db
      .query("typing")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();
    const active = entries.filter((e) => e.userId !== me._id && e.updatedAt >= cutoff);
    const users = await Promise.all(active.map((e) => ctx.db.get(e.userId)));
    return users.filter(Boolean);
  },
});
