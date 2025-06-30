"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          // Redirect to sign in if not authenticated
          router.push('/auth/sign-in');
        } else {
          // Redirect to projects dashboard if authenticated
          router.push('/projects');
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        router.push('/auth/sign-in');
      }
    };

    checkAuth();
  }, [router]);

  // Loading state while checking auth
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-lg">Redirecting to your dashboard...</div>
    </div>
  );
}
