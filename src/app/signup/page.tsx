import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthShell title="Create your account" description="Plan trips, build guides, and share them.">
      <AuthForm mode="signup" />
    </AuthShell>
  );
}
