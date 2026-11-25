"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signIn, signInWithGoogle, signUp, type AuthFormState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Mode = "login" | "signup";

const copy = {
  login: {
    submit: "Log in",
    pending: "Logging in…",
    switchPrompt: "New here?",
    switchLabel: "Create an account",
    switchHref: "/signup",
    passwordAutocomplete: "current-password",
  },
  signup: {
    submit: "Create account",
    pending: "Creating account…",
    switchPrompt: "Already have an account?",
    switchLabel: "Log in",
    switchHref: "/login",
    passwordAutocomplete: "new-password",
  },
} as const;

export function AuthForm({ mode }: { mode: Mode }) {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/home";
  const callbackError = searchParams.get("error");
  const text = copy[mode];

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "login" ? signIn : signUp,
    {},
  );
  const error = state.error ?? callbackError;
  const switchHref = next === "/home" ? text.switchHref : `${text.switchHref}?next=${encodeURIComponent(next)}`;

  return (
    <div className="flex flex-col gap-5">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="outline" size="lg" className="w-full">
          <GoogleIcon />
          Continue with Google
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        or
        <Separator className="flex-1" />
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={text.passwordAutocomplete}
            minLength={mode === "signup" ? 8 : undefined}
            required
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        {state.message ? (
          <p role="status" className="text-sm text-muted-foreground">
            {state.message}
          </p>
        ) : null}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? text.pending : text.submit}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {text.switchPrompt}{" "}
        <Link href={switchHref} className="font-medium text-foreground underline-offset-4 hover:underline">
          {text.switchLabel}
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.56c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.77c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
