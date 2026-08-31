import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireSessionContext } from '@/lib/auth';
import { Sidebar } from '@/components/app/sidebar';
import { UserMenu } from '@/components/app/user-menu';
import { Button } from '@/components/ui/button';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSessionContext();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar entitlements={session.entitlements} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-end gap-3 border-b border-border bg-background/85 px-6 backdrop-blur-md lg:flex">
          <Button asChild size="sm">
            <Link href="/app/analyze">
              <Plus className="h-4 w-4" />
              New analysis
            </Link>
          </Button>
          <UserMenu
            email={session.user.email ?? ''}
            name={session.profile.full_name ?? session.profile.company_name}
          />
        </header>

        <main className="flex-1 px-5 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
