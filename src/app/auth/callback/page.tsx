"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClientComponentClient();

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        const token_hash = searchParams.get("token_hash");
        const type = searchParams.get("type");
        const next = searchParams.get("next") ?? "/";
        const code = searchParams.get("code");

        if (token_hash && type === "email") {
          const { error } = await supabase.auth.verifyOtp({
            type: "email",
            token_hash,
          });

          if (!error) {
            router.push(next);
          } else {
            console.error("Error verifying email:", error);
            router.push("/auth/sign-in?error=Could not verify email");
          }
        } else if (code) {
          // Handle magic link sign in
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            router.push(next);
          } else {
            console.error("Error signing in:", error);
            router.push("/auth/sign-in?error=Could not sign in");
          }
        } else {
          router.push("/auth/sign-in?error=Invalid verification link");
        }
      } catch (error) {
        console.error("Verification error:", error);
        router.push("/auth/sign-in?error=Verification failed");
      }
    };

    handleEmailConfirmation();
  }, [router, searchParams, supabase.auth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg">Verifying your email...</p>
    </div>
  );
}
