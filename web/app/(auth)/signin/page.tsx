'use client';

import { useState } from 'react';
import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { RiErrorWarningFill } from '@remixicon/react';
import {
  AlertCircle,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircleIcon,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useAuth } from '@/providers/auth-provider';
import { useAuthProviders } from '@/services/account';
import { Alert, AlertIcon, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Icons } from '@/components/common/icons';
import { getSigninSchema, SigninSchemaType } from '../forms/signin-schema';

export default function Page() {
  const { login, loginWithGoogle, loginWithPasskey } = useAuth();
  const { data: providersData } = useAuthProviders();
  const providers = providersData?.data;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SigninSchemaType>({
    resolver: zodResolver(getSigninSchema()),
    defaultValues: {
      email: 'admin@gompp.dev',
      password: 'admin123',
      rememberMe: false,
    },
  });

  async function onSubmit(values: SigninSchemaType) {
    setIsProcessing(true);
    setError(null);

    try {
      await login(values.email, values.password);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred. Please try again.',
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const handleGoogleSignIn = async () => {
    if (!providers?.google_client_id) {
      setError('Google Sign-In is not configured yet');
      return;
    }
    setGoogleLoading(true);
    setError(null);
    try {
      await new Promise<void>((resolve, reject) => {
        const loadScript = () => {
          return new Promise<void>((res, rej) => {
            if ((window as any).google?.accounts?.oauth2) {
              res();
              return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.async = true;
            script.onload = () => res();
            script.onerror = () =>
              rej(new Error('Failed to load Google Sign-In'));
            document.head.appendChild(script);
          });
        };

        loadScript()
          .then(() => {
            const g = (window as any).google;
            const client = g.accounts.oauth2.initTokenClient({
              client_id: providers.google_client_id,
              scope: 'openid email profile',
              callback: async (tokenResponse: any) => {
                if (tokenResponse.error) {
                  reject(new Error(tokenResponse.error));
                  return;
                }
                try {
                  await loginWithGoogle(tokenResponse.access_token);
                  resolve();
                } catch (err) {
                  reject(err);
                }
              },
              error_callback: (err: any) => {
                if (err?.type === 'popup_closed') {
                  reject(new Error('cancelled'));
                } else {
                  reject(new Error(err?.message || 'Google sign-in failed'));
                }
              },
            });
            client.requestAccessToken();
          })
          .catch(reject);
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled') {
        // User closed the popup — just stop loading
      } else {
        setError(err instanceof Error ? err.message : 'Google sign-in failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    setPasskeyLoading(true);
    setError(null);
    try {
      await loginWithPasskey();
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setError('Passkey authentication was cancelled');
      } else {
        setError(err instanceof Error ? err.message : 'Passkey sign-in failed');
      }
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="block w-full space-y-5"
      >
        <div className="space-y-1.5 pb-3">
          <h1 className="text-2xl font-semibold tracking-tight text-center">
            Sign in to GoMPP
          </h1>
        </div>

        <Alert size="sm" close={false}>
          <AlertIcon>
            <RiErrorWarningFill className="text-primary" />
          </AlertIcon>
          <AlertTitle className="text-accent-foreground">
            Use <span className="text-mono font-semibold">admin@gompp.dev</span>{' '}
            username and{' '}
            <span className="text-mono font-semibold">admin123</span> for demo
            access.
          </AlertTitle>
        </Alert>

        <div className="relative py-1.5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertIcon>
              <AlertCircle />
            </AlertIcon>
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Your email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center gap-2.5">
                <FormLabel>Password</FormLabel>
                <Link
                  href="/reset-password"
                  className="text-sm font-semibold text-foreground hover:text-primary"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  placeholder="Your password"
                  type={passwordVisible ? 'text' : 'password'}
                  {...field}
                />
                <Button
                  type="button"
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  onClick={() => setPasswordVisible(!passwordVisible)}
                  className="absolute end-0 top-1/2 -translate-y-1/2 h-7 w-7 me-1.5 bg-transparent!"
                  aria-label={
                    passwordVisible ? 'Hide password' : 'Show password'
                  }
                >
                  {passwordVisible ? (
                    <EyeOff className="text-muted-foreground" />
                  ) : (
                    <Eye className="text-muted-foreground" />
                  )}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center space-x-2">
          <FormField
            control={form.control}
            name="rememberMe"
            render={({ field }) => (
              <>
                <Checkbox
                  id="remember-me"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(!!checked)}
                />
                <label
                  htmlFor="remember-me"
                  className="text-sm leading-none text-muted-foreground"
                >
                  Remember me
                </label>
              </>
            )}
          />
        </div>

        <div className="flex flex-col gap-2.5">
          <Button type="submit" disabled={isProcessing}>
            {isProcessing ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : null}
            Continue
          </Button>
        </div>

        {/* Social / Passkey login */}
        <div className="relative py-1.5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
          >
            {googleLoading ? (
              <LoaderCircleIcon className="size-4 animate-spin mr-2" />
            ) : (
              <Icons.googleColorful className="size-5 mr-2" />
            )}
            Sign in with Google
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={passkeyLoading}
            onClick={handlePasskeySignIn}
          >
            {passkeyLoading ? (
              <LoaderCircleIcon className="size-4 animate-spin mr-2" />
            ) : (
              <KeyRound className="size-4 mr-2" />
            )}
            Sign in with Passkey
          </Button>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            className="text-sm font-semibold text-foreground hover:text-primary"
          >
            Sign Up
          </Link>
        </p>
      </form>
    </Form>
  );
}
