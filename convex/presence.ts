import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const ONLINE_THRESHOLD_MS = 60_000; // 1 minute

/** Heartbeat: mark current user as online. */
export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return;
    const now = Date.now();
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: now });
    } else {
      await ctx.db.insert("presence", { userId: me._id, lastSeen: now });
    }
  },
});

/** List user IDs that are currently online (lastSeen within threshold). */
export const listOnlineUserIds = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ONLINE_THRESHOLD_MS;
    const entries = await ctx.db
      .query("presence")
      .withIndex("by_last_seen", (q) => q.gte("lastSeen", cutoff))
      .collect();
    return entries.map((e) => e.userId);
  },
});
