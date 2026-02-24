"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ChatApp } from "@/components/ChatApp";

export default function Home() {
  return (
    <main className="min-h-screen min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden bg-zinc-100 dark:bg-zinc-900">
      <AuthLoading>
        <div className="flex min-h-screen min-h-[100dvh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex min-h-screen min-h-[100dvh] w-full flex-col items-center justify-center gap-6 px-4 py-8 sm:p-6 md:gap-8 md:p-8">
          <h1 className="text-center text-xl font-semibold text-zinc-800 dark:text-zinc-100 sm:text-2xl md:text-3xl">
            Tars Live Chat
          </h1>
          <p className="max-w-sm text-center text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            Sign in to start messaging. Use email or social login.
          </p>
          <div className="flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:gap-4">
            <SignInButton mode="modal">
              <button className="min-h-[44px] w-full min-w-[120px] rounded-lg bg-zinc-800 px-4 py-3 text-base text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300 sm:py-2">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="min-h-[44px] w-full min-w-[120px] rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 sm:py-2">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <ChatApp />
      </Authenticated>
    </main>
  );
}
