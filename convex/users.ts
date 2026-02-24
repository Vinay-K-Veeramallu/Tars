import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/** Ensure current user has a profile in Convex; create/update from Clerk identity. */
export const ensureProfile = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    if (identity.subject !== args.clerkId) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        imageUrl: args.imageUrl ?? existing.imageUrl,
        email: args.email ?? existing.email,
      });
      return existing._id;
    }
    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      name: args.name,
      imageUrl: args.imageUrl,
      email: args.email,
    });
  },
});

/** List all users except the current one (for discovery). */
export const listOthers = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const me = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!me) return [];

    let users = await ctx.db.query("users").collect();
    users = users.filter((u) => u._id !== me._id);
    const search = (args.search ?? "").trim().toLowerCase();
    if (search) {
      users = users.filter((u) => u.name.toLowerCase().includes(search));
    }
    return users;
  },
});

/** Get user by Convex user id. */
export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/** Get current user's Convex profile by Clerk id. */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
  },
});
