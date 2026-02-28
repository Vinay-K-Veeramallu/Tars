"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { ChatApp } from "@/components/ChatApp";

export default function Home() {
  return (
    <main className="min-h-screen min-h-[100dvh] w-full max-w-[100vw] overflow-x-hidden">
      <AuthLoading>
        <div className="flex min-h-screen min-h-[100dvh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex min-h-screen min-h-[100dvh] w-full flex-col items-center justify-center px-4 py-12 sm:py-16">
          <div className="animate-fade-in glass-strong flex max-w-md flex-col items-center gap-8 rounded-3xl p-8 text-center shadow-[var(--shadow-md)] sm:p-10">
            <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[var(--accent-muted)]/80 text-5xl shadow-[var(--shadow)] backdrop-blur-sm">
              💬
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
                Tars Live Chat
              </h1>
              <p className="text-[var(--muted)] sm:text-lg">
                Real-time messaging. Sign in with email or your favorite provider to get started.
              </p>
            </div>
            <div className="animate-slide-up flex w-full flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <SignInButton mode="modal">
                <button className="min-h-[52px] w-full rounded-2xl bg-[var(--accent)] px-8 py-3 font-semibold text-white shadow-[var(--shadow)] transition hover:bg-[var(--accent-hover)] hover:shadow-[var(--shadow-md)] active:scale-[0.98] sm:w-auto">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="glass-input min-h-[52px] w-full rounded-2xl px-8 py-3 font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)] active:scale-[0.98] sm:w-auto">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <ChatApp />
      </Authenticated>
    </main>
  );
}
