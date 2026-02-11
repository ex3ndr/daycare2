import { useState, useRef, useEffect } from "react";
import { createRoute, redirect } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { guardLogin } from "@/app/lib/routeGuard";
import { sessionSet } from "@/app/lib/sessionStore";
import { apiClientCreate } from "@/app/daycare/api/apiClientCreate";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/app/components/ui/card";
import { Loader2, ArrowLeft, Mail, KeyRound } from "lucide-react";

const api = apiClientCreate("");

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "login",
  beforeLoad: ({ context }) => {
    const result = guardLogin(context.auth);
    if (result.redirect) {
      throw redirect({ to: result.redirect });
    }
  },
  component: LoginPage,
});

type LoginStep = "email" | "otp";

function LoginPage() {
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "email") {
      emailInputRef.current?.focus();
    } else {
      otpInputRef.current?.focus();
    }
  }, [step]);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.authRequestOtp(email);
    } catch {
      // OTP request may fail (e.g. email service unavailable) but
      // static/test OTP codes still work via verify-otp directly.
    }
    setStep("otp");
    setLoading(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { token, account } = await api.authVerifyOtp(email, otpCode);
      sessionSet({ token, accountId: account.id });
      window.location.href = "/orgs";
      return;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Invalid code, please try again"
      );
      setLoading(false);
    }
  }

  function handleBack() {
    setStep("email");
    setOtpCode("");
    setError(null);
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      {/* Grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {step === "email" ? (
              <Mail className="h-6 w-6 text-primary" />
            ) : (
              <KeyRound className="h-6 w-6 text-primary" />
            )}
          </div>
          <CardTitle className="font-display text-2xl">
            {step === "email" ? "Welcome to Daycare" : "Check your email"}
          </CardTitle>
          <CardDescription>
            {step === "email"
              ? "Sign in with your email address"
              : `We sent a 6-digit code to ${email}`}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {step === "email" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <Input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                disabled={loading}
                required
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !email}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending code...
                  </>
                ) : (
                  "Continue with email"
                )}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <Input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="000000"
                disabled={loading}
                className="text-center text-lg tracking-[0.3em] font-mono"
                required
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={loading || otpCode.length !== 6}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          )}
        </CardContent>

        {step === "otp" && (
          <CardFooter className="justify-center">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              disabled={loading}
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Use a different email
            </button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
