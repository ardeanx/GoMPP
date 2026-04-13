'use client';

import { useRef, useState } from 'react';
import {
  ColumnDef,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { AccountSession } from '@/types/api';
import { apiClient } from '@/lib/api-client';
import { getInitials } from '@/lib/helpers';
import { useAuth } from '@/providers/auth-provider';
import {
  useAccountSessions,
  useAuthProviders,
  useCreateAccountSession,
  useDeleteAccountSession,
  useDeleteAvatar,
  useDeletePasskey,
  useLinkGoogle,
  usePasskeys,
  useRenamePasskey,
  useUnlinkGoogle,
  useUploadAvatar,
} from '@/services/account';
import { useChangePassword, useUpdateUser } from '@/services/users';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Icons } from '@/components/common/icons';
import {
  Toolbar,
  ToolbarHeading,
} from '@/components/layouts/main/components/toolbar';

// helpers

function formatDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
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
      return 'User';
  }
}

function roleBadgeVariant(
  role: string,
): 'primary' | 'secondary' | 'destructive' | 'outline' {
  switch (role) {
    case 'super_admin':
      return 'primary';
    case 'admin':
      return 'secondary';
    default:
      return 'outline';
  }
}

function passwordChangedText(date?: string): string {
  if (!date) return 'Never changed';
  return `Password last changed ${formatDistanceToNow(new Date(date), { addSuffix: true })}`;
}

// session table columns

const sessionColumns: ColumnDef<AccountSession, unknown>[] = [
  {
    id: 'select',
    header: () => <DataGridTableRowSelectAll />,
    cell: ({ row }) => <DataGridTableRowSelect row={row} />,
    size: 40,
    enableSorting: false,
    enableHiding: false,
    meta: { headerClassName: 'w-10', cellClassName: 'w-10' },
  },
  {
    accessorKey: 'device_name',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Device" />
    ),
    cell: ({ row }) => {
      const s = row.original;
      return (
        <div className="min-w-0">
          <p className="font-medium truncate">{s.device_name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {s.device_os}
          </p>
        </div>
      );
    },
    size: 200,
    meta: { skeleton: <Skeleton className="h-8 w-36" /> },
  },
  {
    accessorKey: 'browser',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Browser" />
    ),
    cell: ({ row }) => (
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-green-500" />
        {row.original.browser}
      </span>
    ),
    size: 220,
    meta: { skeleton: <Skeleton className="h-4 w-40" /> },
  },
  {
    accessorKey: 'ip_address',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="IP Address" />
    ),
    cell: ({ row }) => row.original.ip_address ?? '–',
    size: 160,
    meta: { skeleton: <Skeleton className="h-4 w-28" /> },
  },
  {
    accessorKey: 'location',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Location" />
    ),
    cell: ({ row }) => row.original.location || '–',
    size: 160,
    meta: { skeleton: <Skeleton className="h-4 w-24" /> },
  },
  {
    accessorKey: 'last_session_at',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Last Session" />
    ),
    cell: ({ row }) => formatDate(row.original.last_session_at),
    size: 150,
    meta: { skeleton: <Skeleton className="h-4 w-24" /> },
  },
  {
    id: 'actions',
    header: () => null,
    cell: () => null,
    size: 50,
    enableSorting: false,
    enableHiding: false,
    meta: { headerClassName: 'w-10', cellClassName: 'w-10' },
  },
];

// page

export default function AccountPage() {
  const { user, refreshUser } = useAuth();
  const updateUser = useUpdateUser();
  const changePassword = useChangePassword();
  const deleteSession = useDeleteAccountSession();
  const createSession = useCreateAccountSession();
  const uploadAvatar = useUploadAvatar();
  const deleteAvatar = useDeleteAvatar();
  const linkGoogle = useLinkGoogle();
  const unlinkGoogle = useUnlinkGoogle();
  const { data: passkeysData } = usePasskeys();
  const renamePasskey = useRenamePasskey();
  const deletePasskeyMut = useDeletePasskey();
  const { data: providersData } = useAuthProviders();
  const providers = providersData?.data;
  const passkeys = passkeysData?.data ?? [];
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Session table state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const { data: sessionsData, isLoading: sessionsLoading } = useAccountSessions(
    { page, per_page: perPage },
  );
  const sessions = sessionsData?.data ?? [];
  const sessionsMeta = sessionsData?.meta;
  const totalSessions = sessionsMeta?.total ?? 0;

  // Edit name dialog
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');

  // Edit email dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [editEmail, setEditEmail] = useState('');

  // Change password dialog
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Add device dialog
  const [addDeviceOpen, setAddDeviceOpen] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [deviceOs, setDeviceOs] = useState('');
  const [deviceBrowser, setDeviceBrowser] = useState('');
  const [deviceLocation, setDeviceLocation] = useState('');

  // Sign-in methods dialog
  const [signInDialogOpen, setSignInDialogOpen] = useState(false);
  const [passkeyNameDialogOpen, setPasskeyNameDialogOpen] = useState(false);
  const [editPasskeyId, setEditPasskeyId] = useState('');
  const [editPasskeyName, setEditPasskeyName] = useState('');
  const [registeringPasskey, setRegisteringPasskey] = useState(false);

  const openNameDialog = () => {
    setEditName(user?.username ?? '');
    setNameDialogOpen(true);
  };

  const openEmailDialog = () => {
    setEditEmail(user?.email ?? '');
    setEmailDialogOpen(true);
  };

  const handleNameSave = async () => {
    if (!user || !editName.trim()) return;
    try {
      await updateUser.mutateAsync({
        id: user.id,
        data: { username: editName.trim() },
      });
      toast.success('Name updated');
      setNameDialogOpen(false);
      refreshUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleEmailSave = async () => {
    if (!user || !editEmail.trim()) return;
    try {
      await updateUser.mutateAsync({
        id: user.id,
        data: { email: editEmail.trim() },
      });
      toast.success('Email updated');
      setEmailDialogOpen(false);
      refreshUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handlePasswordChange = async () => {
    if (!user) return;
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    try {
      await changePassword.mutateAsync({
        id: user.id,
        newPassword,
      });
      toast.success('Password changed');
      setPwDialogOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      refreshUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Change failed');
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Remove this device from your account?')) return;
    try {
      await deleteSession.mutateAsync(id);
      toast.success('Session removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleAddDevice = async () => {
    if (!deviceName.trim() || !deviceOs.trim() || !deviceBrowser.trim()) {
      toast.error('Please fill in device name, OS, and browser');
      return;
    }
    try {
      await createSession.mutateAsync({
        device_name: deviceName.trim(),
        device_os: deviceOs.trim(),
        browser: deviceBrowser.trim(),
        location: deviceLocation.trim(),
      });
      toast.success('Device added');
      setAddDeviceOpen(false);
      setDeviceName('');
      setDeviceOs('');
      setDeviceBrowser('');
      setDeviceLocation('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add device');
    }
  };

  // Avatar upload handler
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Avatar must be under 5 MB');
      return;
    }
    try {
      await uploadAvatar.mutateAsync(file);
      toast.success('Avatar updated');
      refreshUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
    // Reset input so same file can be re-selected
    if (avatarInputRef.current) avatarInputRef.current.value = '';
  };

  const handleRemoveAvatar = async () => {
    try {
      await deleteAvatar.mutateAsync();
      toast.success('Avatar removed');
      refreshUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Remove failed');
    }
  };

  // Google account linking
  const handleLinkGoogle = async () => {
    if (!providers?.google_client_id) {
      toast.error('Google Sign-In is not configured');
      return;
    }
    try {
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

      await loadScript();
      const g = (window as any).google;

      await new Promise<void>((resolve, reject) => {
        const client = g.accounts.oauth2.initTokenClient({
          client_id: providers.google_client_id,
          scope: 'openid email profile',
          callback: async (tokenResponse: any) => {
            if (tokenResponse.error) {
              reject(new Error(tokenResponse.error));
              return;
            }
            try {
              await linkGoogle.mutateAsync(tokenResponse.access_token);
              toast.success('Google account linked');
              refreshUser();
              resolve();
            } catch (err) {
              reject(err);
            }
          },
          error_callback: (err: any) => {
            if (err?.type === 'popup_closed') {
              reject(new Error('cancelled'));
            } else {
              reject(new Error(err?.message || 'Google link failed'));
            }
          },
        });
        client.requestAccessToken();
      });
    } catch (err) {
      if (!(err instanceof Error && err.message === 'cancelled')) {
        toast.error(err instanceof Error ? err.message : 'Google link failed');
      }
    }
  };

  const handleUnlinkGoogle = async () => {
    if (!confirm('Unlink your Google account?')) return;
    try {
      await unlinkGoogle.mutateAsync();
      toast.success('Google account unlinked');
      refreshUser();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unlink failed');
    }
  };

  // Passkey management
  const handleRegisterPasskey = async () => {
    if (!providers?.passkey) {
      toast.error('Passkeys are not configured');
      return;
    }
    setRegisteringPasskey(true);
    try {
      // Step 1: Begin registration
      const beginRes = await apiClient<{
        data: { options: any; session: string };
      }>('/account/passkeys/register/begin', { method: 'POST' });

      // Step 2: Browser authenticator ceremony
      const { startRegistration } = await import('@simplewebauthn/browser');
      const credential = await startRegistration({
        optionsJSON: beginRes.data.options.publicKey,
      });

      // Step 3: Finish registration
      await apiClient('/account/passkeys/register/finish', {
        method: 'POST',
        body: JSON.stringify({
          session: beginRes.data.session,
          name: 'Passkey',
          credential,
        }),
      });

      toast.success('Passkey registered');
      refreshUser();
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        toast.error('Passkey registration was cancelled');
      } else {
        toast.error(err instanceof Error ? err.message : 'Registration failed');
      }
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const handleRenamePasskey = async () => {
    if (!editPasskeyName.trim()) return;
    try {
      await renamePasskey.mutateAsync({
        id: editPasskeyId,
        name: editPasskeyName.trim(),
      });
      toast.success('Passkey renamed');
      setPasskeyNameDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    }
  };

  const handleDeletePasskey = async (id: string) => {
    if (!confirm('Delete this passkey?')) return;
    try {
      await deletePasskeyMut.mutateAsync(id);
      toast.success('Passkey deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Build columns with delete action
  const columnsWithActions = sessionColumns.map((col) => {
    if ('id' in col && col.id === 'actions') {
      return {
        ...col,
        cell: ({ row }: { row: { original: AccountSession } }) => (
          <Button
            variant="ghost"
            mode="icon"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteSession(row.original.id);
            }}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        ),
      };
    }
    return col;
  });

  const table = useReactTable({
    data: sessions,
    columns: columnsWithActions,
    pageCount: sessionsMeta?.total_pages ?? -1,
    state: {
      pagination: { pageIndex: page - 1, pageSize: perPage },
    },
    onPaginationChange: (updater) => {
      const prev = { pageIndex: page - 1, pageSize: perPage };
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setPage(next.pageIndex + 1);
      setPerPage(next.pageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    enableRowSelection: true,
  });

  if (!user) return null;

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="My Account" />
      </Toolbar>

      <div className="container space-y-6">
        {/* Top Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Photo */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-14">
                    Photo
                  </span>
                  <span className="text-sm text-muted-foreground">
                    WebP, JPEG, or PNG Image
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {user.avatar_url && (
                    <Button
                      variant="ghost"
                      mode="icon"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      title="Remove avatar"
                    >
                      <X className="size-4 text-muted-foreground" />
                    </Button>
                  )}
                  <button
                    type="button"
                    className="cursor-pointer"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    <Avatar className="size-12">
                      {user.avatar_url && (
                        <AvatarImage
                          src={user.avatar_url}
                          alt={user.username}
                        />
                      )}
                      <AvatarFallback className="text-sm font-semibold">
                        {getInitials(user.username, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
              </div>

              {/* Name */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-14">
                    Name
                  </span>
                  <span className="text-sm font-medium">{user.username}</span>
                </div>
                <Button
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  onClick={openNameDialog}
                >
                  <Pencil className="size-4 text-primary" />
                </Button>
              </div>

              {/* Role */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground w-14">Role</span>
                <Badge variant={roleBadgeVariant(user.role)}>
                  {roleLabel(user.role)}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Email */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20">
                    Email
                  </span>
                  <span className="text-sm font-medium">{user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  onClick={openEmailDialog}
                >
                  <Pencil className="size-4 text-primary" />
                </Button>
              </div>

              {/* Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20">
                    Password
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {passwordChangedText(user.password_changed_at)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  onClick={() => setPwDialogOpen(true)}
                >
                  <Pencil className="size-4 text-primary" />
                </Button>
              </div>

              {/* 2FA */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20">
                    2FA
                  </span>
                  <span className="text-sm text-muted-foreground">
                    To be set
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() =>
                    toast.info('Two-factor authentication coming soon')
                  }
                >
                  Setup
                </Button>
              </div>

              {/* Sign-in with */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground w-20">
                    Sign-in with
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex size-8 items-center justify-center rounded-full border ${user.has_google ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}`}
                      title={
                        user.has_google ? 'Google linked' : 'Google not linked'
                      }
                    >
                      <Icons.googleColorful className="size-4" />
                    </span>
                    <span
                      className={`inline-flex size-8 items-center justify-center rounded-full border ${user.passkey_count > 0 ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''}`}
                      title={
                        user.passkey_count > 0
                          ? `${user.passkey_count} passkey(s)`
                          : 'No passkeys'
                      }
                    >
                      <KeyRound className="size-4" />
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  mode="icon"
                  size="sm"
                  onClick={() => setSignInDialogOpen(true)}
                >
                  <Pencil className="size-4 text-primary" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Logs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Account Logs</h2>
            <Button onClick={() => setAddDeviceOpen(true)}>
              <Plus className="size-4 mr-1.5" />
              Add Device
            </Button>
          </div>

          <DataGrid
            table={table}
            recordCount={totalSessions}
            isLoading={sessionsLoading}
            loadingMode="skeleton"
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
              <DataGridTable />
              <div className="relative border-t px-4 py-2">
                <DataGridPagination
                  sizes={[10, 20, 50, 100]}
                  info={`{from} - {to} of ${formatNumber(totalSessions)}`}
                />
                <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-muted-foreground whitespace-nowrap">
                  Showing {formatNumber(sessions.length)} of{' '}
                  {formatNumber(totalSessions)} sessions
                </p>
              </div>
            </DataGridContainer>
          </DataGrid>
        </div>
      </div>

      {/* Edit Name Dialog */}
      <Dialog open={nameDialogOpen} onOpenChange={setNameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Name</DialogTitle>
            <DialogDescription>Update your display name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleNameSave} disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Email</DialogTitle>
            <DialogDescription>Update your email address.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
          <DialogFooter>
            <Button onClick={handleEmailSave} disabled={updateUser.isPending}>
              {updateUser.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter a new password (min 8 characters).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handlePasswordChange}
              disabled={changePassword.isPending}
            >
              {changePassword.isPending ? 'Changing...' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Device Dialog */}
      <Dialog open={addDeviceOpen} onOpenChange={setAddDeviceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Device</DialogTitle>
            <DialogDescription>
              Register a new device to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Device Name</Label>
              <Input
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="e.g. MacBook Pro"
              />
            </div>
            <div className="space-y-2">
              <Label>Operating System</Label>
              <Input
                value={deviceOs}
                onChange={(e) => setDeviceOs(e.target.value)}
                placeholder="e.g. macOS 14"
              />
            </div>
            <div className="space-y-2">
              <Label>Browser</Label>
              <Input
                value={deviceBrowser}
                onChange={(e) => setDeviceBrowser(e.target.value)}
                placeholder="e.g. Chrome 120"
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={deviceLocation}
                onChange={(e) => setDeviceLocation(e.target.value)}
                placeholder="e.g. Jakarta, Indonesia"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddDevice}
              disabled={createSession.isPending}
            >
              {createSession.isPending ? 'Adding...' : 'Add Device'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign-in Methods Dialog */}
      <Dialog open={signInDialogOpen} onOpenChange={setSignInDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign-in Methods</DialogTitle>
            <DialogDescription>
              Manage how you sign in to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Google */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-full border">
                  <Icons.googleColorful className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-medium">Google</p>
                  <p className="text-xs text-muted-foreground">
                    {user.has_google ? 'Linked' : 'Not linked'}
                  </p>
                </div>
              </div>
              {user.has_google ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlinkGoogle}
                  disabled={unlinkGoogle.isPending}
                >
                  Unlink
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleLinkGoogle}
                  disabled={linkGoogle.isPending}
                >
                  Link
                </Button>
              )}
            </div>

            {/* Passkeys */}
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-full border">
                    <KeyRound className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">Passkeys</p>
                    <p className="text-xs text-muted-foreground">
                      {passkeys.length} registered
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleRegisterPasskey}
                  disabled={registeringPasskey}
                >
                  {registeringPasskey ? 'Registering...' : 'Add Passkey'}
                </Button>
              </div>

              {/* Passkey list */}
              {passkeys.length > 0 && (
                <div className="space-y-2 pl-12">
                  {passkeys.map((pk) => (
                    <div
                      key={pk.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium">{pk.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Added {formatDate(pk.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          mode="icon"
                          size="sm"
                          onClick={() => {
                            setEditPasskeyId(pk.id);
                            setEditPasskeyName(pk.name);
                            setPasskeyNameDialogOpen(true);
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          mode="icon"
                          size="sm"
                          onClick={() => handleDeletePasskey(pk.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Passkey Dialog */}
      <Dialog
        open={passkeyNameDialogOpen}
        onOpenChange={setPasskeyNameDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Passkey</DialogTitle>
            <DialogDescription>
              Give this passkey a recognizable name.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={editPasskeyName}
              onChange={(e) => setEditPasskeyName(e.target.value)}
              placeholder="e.g. MacBook Touch ID"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={handleRenamePasskey}
              disabled={renamePasskey.isPending}
            >
              {renamePasskey.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
