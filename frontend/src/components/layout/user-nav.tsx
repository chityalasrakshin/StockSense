'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/context/auth-context';
import Link from 'next/link';

export function UserNav() {
  const { user, role, logout } = useAuth();

  const roleLabel =
    role === 'INVENTORY_MANAGER'
      ? 'Inventory Manager'
      : role === 'WAREHOUSE_STAFF'
        ? 'Warehouse Staff'
        : 'User';

  const initials = user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : role === 'INVENTORY_MANAGER'
      ? 'IM'
      : 'WS';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="relative h-8 w-8 rounded-full p-0"
            aria-label="User menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        }
      />
      <DropdownMenuContent className="w-56" align="end" sideOffset={6}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{roleLabel}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email || 'authenticated'}
              </p>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            Role:{' '}
            <span className="ml-1 font-semibold text-primary">
              {role === 'INVENTORY_MANAGER' ? 'Manager' : 'Staff'}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/profile" />}>
            My Profile
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive cursor-pointer"
          onClick={() => logout()}
        >
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
