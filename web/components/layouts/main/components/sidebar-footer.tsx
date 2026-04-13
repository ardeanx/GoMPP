import { BellDot, LayoutGrid } from 'lucide-react';
import { getInitials } from '@/lib/helpers';
import { useAuth } from '@/providers/auth-provider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { AppsDropdownMenu } from '../../shared/apps-dropdown-menu';
import { NotificationsSheet } from '../../shared/notifications-sheet';
import { UserDropdownMenu } from '../../shared/user-dropdown-menu';

export function SidebarFooter() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-5 items-center shrink-0 pb-5">
      <div className="flex flex-col gap-1.5">
        <NotificationsSheet
          trigger={
            <Button
              variant="ghost"
              mode="icon"
              className="hover:[&_svg]:text-primary"
            >
              <BellDot className="size-4.5!" />
            </Button>
          }
        />
        <AppsDropdownMenu
          trigger={
            <Button
              variant="ghost"
              mode="icon"
              className="hover:bg-background hover:[&_svg]:text-primary"
            >
              <LayoutGrid className="size-4.5!" />
            </Button>
          }
        />
      </div>

      <UserDropdownMenu
        trigger={
          <Avatar className="size-8 rounded-lg border-2 border-mono/30 shrink-0 cursor-pointer">
            {user?.avatar_url && (
              <AvatarImage src={user.avatar_url} alt="User Avatar" />
            )}
            <AvatarFallback className="text-xs font-semibold rounded-lg">
              {getInitials(user?.username || '', 2)}
            </AvatarFallback>
          </Avatar>
        }
      />
    </div>
  );
}
