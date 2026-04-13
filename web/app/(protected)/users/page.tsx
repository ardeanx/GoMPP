'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ColumnDef,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  UserCog,
} from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/types/api';
import { getInitials } from '@/lib/helpers';
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers,
} from '@/services/users';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DataGrid, DataGridContainer } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import {
  DataGridTable,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from '@/components/ui/data-grid-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Toolbar,
  ToolbarHeading,
} from '@/components/layouts/main/components/toolbar';

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatLastLogin(date: string): string {
  const d = new Date(date);
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const day = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${time} - ${day}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function roleLabel(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'admin':
      return 'Admin';
    case 'staff':
      return 'Staff';
    default:
      return 'Staff';
  }
}

// column definitions

const columns: ColumnDef<User, unknown>[] = [
  {
    id: 'select',
    header: () => <DataGridTableRowSelectAll />,
    cell: ({ row }) => <DataGridTableRowSelect row={row} />,
    size: 40,
    enableSorting: false,
    enableHiding: false,
    meta: {
      headerClassName: 'w-10',
      cellClassName: 'w-10',
    },
  },
  {
    accessorKey: 'username',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const user = row.original;
      return (
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="text-xs font-semibold">
              {getInitials(user.username, 3)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium truncate">{user.username}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>
      );
    },
    size: 250,
    meta: {
      skeleton: <Skeleton className="h-9 w-48" />,
    },
  },
  {
    accessorKey: 'last_login_at',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Last Login" />
    ),
    cell: ({ row }) =>
      row.original.last_login_at
        ? formatLastLogin(row.original.last_login_at)
        : '–',
    size: 200,
    meta: {
      skeleton: <Skeleton className="h-4 w-36" />,
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Register Date" />
    ),
    cell: ({ row }) => formatDate(row.original.created_at),
    size: 160,
    meta: {
      skeleton: <Skeleton className="h-4 w-28" />,
    },
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Roles" />
    ),
    cell: ({ row }) => roleLabel(row.original.role),
    size: 140,
    meta: {
      skeleton: <Skeleton className="h-4 w-20" />,
    },
  },
  {
    accessorKey: 'total_videos_uploaded',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Total Video Uploaded" />
    ),
    cell: ({ row }) => formatNumber(row.original.total_videos_uploaded ?? 0),
    size: 180,
    meta: {
      skeleton: <Skeleton className="h-4 w-12" />,
    },
  },
  {
    id: 'actions',
    header: () => null,
    cell: () => null,
    size: 50,
    enableSorting: false,
    enableHiding: false,
    meta: {
      headerClassName: 'w-10',
      cellClassName: 'w-10',
    },
  },
];

// main page

export default function UsersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([
    { id: 'created_at', desc: true },
  ]);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState<User['role']>('staff');
  const [editActive, setEditActive] = useState(true);

  // Add New User dialog
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<User['role']>('staff');

  const sortField = sorting[0]?.id ?? 'created_at';
  const sortOrder: 'asc' | 'desc' = sorting[0]?.desc ? 'desc' : 'asc';

  const { data, isLoading } = useUsers({
    page,
    per_page: perPage,
    search: search || undefined,
  });
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();
  const createMutation = useCreateUser();

  const users = data?.data ?? [];
  const meta = data?.meta;
  const totalRecords = meta?.total ?? 0;

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditRole(user.role);
    setEditActive(user.is_active);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    try {
      await updateMutation.mutateAsync({
        id: editUser.id,
        data: { role: editRole, is_active: editActive },
      });
      toast.success('User updated');
      setEditUser(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`Deactivate user "${username}"? They will lose access.`))
      return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('User deactivated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newUsername.trim() || !newPassword.trim()) {
      toast.error('All fields are required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    try {
      await createMutation.mutateAsync({
        email: newEmail.trim(),
        username: newUsername.trim(),
        password: newPassword,
        role: newRole,
      });
      toast.success('User created');
      setAddOpen(false);
      setNewEmail('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('staff');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Creation failed');
    }
  };

  // Build columns with actions that have access to handlers
  const columnsWithActions = columns.map((col) => {
    if ('id' in col && col.id === 'actions') {
      return {
        ...col,
        cell: ({ row }: { row: { original: User } }) => {
          const user = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" mode="icon" size="sm">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(user);
                  }}
                >
                  <UserCog className="size-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(user.id, user.username);
                  }}
                >
                  <Trash2 className="size-4 mr-2" />
                  Deactivate
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      };
    }
    return col;
  });

  const table = useReactTable({
    data: users,
    columns: columnsWithActions,
    pageCount: meta?.total_pages ?? -1,
    state: {
      sorting,
      pagination: { pageIndex: page - 1, pageSize: perPage },
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      setPage(1);
    },
    onPaginationChange: (updater) => {
      const prev = { pageIndex: page - 1, pageSize: perPage };
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setPage(next.pageIndex + 1);
      setPerPage(next.pageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
  });

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Users" />
      </Toolbar>

      <div className="container space-y-4">
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          loadingMode="skeleton"
          onRowClick={(user) => openEdit(user)}
          tableLayout={{
            cellBorder: true,
            rowBorder: true,
            headerBorder: true,
            headerBackground: true,
            width: 'fixed',
          }}
          tableClassNames={{
            headerRow: '[&>th]:border-t',
          }}
        >
          <DataGridContainer>
            {/* Search & Filter Bar */}
            <div className="flex items-center gap-3 p-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="size-4 mr-1.5" />
                Filter
              </Button>
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4 mr-1.5" />
                Add New
              </Button>
            </div>
            <DataGridTable />
            <div className="relative border-t px-4 py-2">
              <DataGridPagination
                sizes={[10, 20, 50, 100]}
                info={`{from} - {to} of ${formatNumber(totalRecords)}`}
              />
              <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground whitespace-nowrap">
                Showing {formatNumber(users.length)} of{' '}
                {formatNumber(totalRecords)} users
              </p>
            </div>
          </DataGridContainer>
        </DataGrid>
      </div>

      {/* Edit User Dialog */}
      <Dialog
        open={!!editUser}
        onOpenChange={(open) => !open && setEditUser(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update role and status for {editUser?.username}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as User['role'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={editActive} onCheckedChange={setEditActive} />
              <Label>Account Active</Label>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add New User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="username"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as User['role'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
