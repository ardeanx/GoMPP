'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ColumnDef,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ChevronDown,
  Film,
  Filter,
  FolderOpen,
  MoreHorizontal,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { Video } from '@/types/api';
import { useAnalyticsOverview } from '@/services/analytics';
import { useDeleteVideo, useUploadVideo, useVideos } from '@/services/videos';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Toolbar,
  ToolbarActions,
  ToolbarHeading,
} from '@/components/layouts/main/components/toolbar';
import { VideoDetailDialog } from './components/video-detail-dialog';

// helpers

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

// stat cards

function StatsCards() {
  const { data, isLoading } = useAnalyticsOverview('30d');
  const stats = data?.data;

  const cards = [
    {
      title: 'Total Videos',
      value: stats ? formatNumber(stats.total_videos) : '—',
      trend: 23.08,
    },
    {
      title: 'Total Folders',
      value: '0',
      trend: 0,
    },
    {
      title: 'Storage Used',
      value: stats ? formatBytes(stats.storage_used_bytes) : '—',
      trend: -0.39,
    },
    {
      title: 'In Queues',
      value: stats
        ? `${stats.active_jobs} Video${stats.active_jobs !== 1 ? 's' : ''}`
        : '—',
      trend: 1.04,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{card.title}</p>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mt-1" />
            ) : (
              <p className="text-2xl font-bold mt-1">{card.value}</p>
            )}
            {card.trend !== 0 && (
              <div
                className={`flex items-center gap-1 text-xs mt-1.5 ${
                  card.trend >= 0 ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {card.trend >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {Math.abs(card.trend).toFixed(2)}%
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// column definitions

const columns: ColumnDef<Video, unknown>[] = [
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
    accessorKey: 'title',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Videos" />
    ),
    cell: ({ row }) => {
      const video = row.original;
      return (
        <div className="flex items-center gap-3">
          <div className="size-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {video.thumbnail_path ? (
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:8080'}/${video.thumbnail_path}`}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Film className="size-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{video.title}</p>
            {video.duration !== undefined && video.duration > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatDuration(video.duration)}
              </p>
            )}
          </div>
        </div>
      );
    },
    size: 350,
    meta: {
      skeleton: <Skeleton className="h-10 w-64" />,
    },
  },
  {
    accessorKey: 'file_size',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Size" />
    ),
    cell: ({ row }) => {
      const transcoded = row.original.transcoded_size;
      return formatBytes(transcoded > 0 ? transcoded : row.original.file_size);
    },
    size: 100,
    meta: {
      skeleton: <Skeleton className="h-4 w-16" />,
    },
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Upload Date" />
    ),
    cell: ({ row }) =>
      new Date(row.original.created_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    size: 160,
    meta: {
      skeleton: <Skeleton className="h-4 w-28" />,
    },
  },
  {
    accessorKey: 'view_count',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Total Views" />
    ),
    cell: ({ row }) => formatNumber(row.original.view_count ?? 0),
    size: 110,
    meta: {
      skeleton: <Skeleton className="h-4 w-12" />,
    },
  },
  {
    id: 'bandwidth',
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title="Bandwidth Served" />
    ),
    cell: () => '—',
    enableSorting: false,
    size: 140,
    meta: {
      skeleton: <Skeleton className="h-4 w-16" />,
    },
  },
  {
    id: 'actions',
    header: () => null,
    cell: () => null, // Rendered via onRowClick; see ActionsCell wrapper below
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

export default function LibraryPage() {
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [sorting, setSorting] = useState<{ id: string; desc: boolean }[]>([
    { id: 'created_at', desc: true },
  ]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [detailVideoId, setDetailVideoId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map tanstack sorting → API params
  const sortField = sorting[0]?.id ?? 'created_at';
  const sortOrder: 'asc' | 'desc' = sorting[0]?.desc ? 'desc' : 'asc';

  const { data, isLoading } = useVideos({
    page,
    per_page: perPage,
    search: search || undefined,
    sort: sortField,
    order: sortOrder,
  });

  const uploadMutation = useUploadVideo();
  const deleteMutation = useDeleteVideo();

  const videos = data?.data ?? [];
  const meta = data?.meta;
  const totalRecords = meta?.total ?? 0;

  // Build columns with actions that have access to handlers
  const columnsWithActions = useMemo<ColumnDef<Video, unknown>[]>(() => {
    return columns.map((col) => {
      if ('id' in col && col.id === 'actions') {
        return {
          ...col,
          cell: ({ row }: { row: { original: Video } }) => {
            const video = row.original;
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
                      setDetailVideoId(video.id);
                      setDetailOpen(true);
                    }}
                  >
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(video.id, video.title);
                    }}
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            );
          },
        };
      }
      return col;
    });
  }, []);

  const table = useReactTable({
    data: videos,
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

  const handleUpload = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const file = fileInputRef.current?.files?.[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

      try {
        await uploadMutation.mutateAsync(formData);
        toast.success('Video uploaded successfully');
        setUploadOpen(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [uploadMutation],
  );

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      if (!confirm(`Delete "${title}"? This action cannot be undone.`)) return;
      try {
        await deleteMutation.mutateAsync(id);
        toast.success('Video deleted');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed');
      }
    },
    [deleteMutation],
  );

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Library" />
        <ToolbarActions>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                Add New
                <ChevronDown className="size-4 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                <Upload className="size-4 mr-2" />
                Upload Video
              </DropdownMenuItem>
              <DropdownMenuItem>
                <FolderOpen className="size-4 mr-2" />
                New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ToolbarActions>
      </Toolbar>

      <div className="container space-y-6">
        {/* Stat Cards */}
        <StatsCards />

        {/* Tabs */}
        <Tabs defaultValue="videos">
          <TabsList>
            <TabsTrigger value="videos">Videos</TabsTrigger>
            <TabsTrigger value="folders">Folder</TabsTrigger>
          </TabsList>

          <TabsContent value="videos" className="mt-4">
            {/* DataGrid Table */}
            <DataGrid
              table={table}
              recordCount={totalRecords}
              isLoading={isLoading}
              loadingMode="skeleton"
              onRowClick={(video) => {
                setDetailVideoId(video.id);
                setDetailOpen(true);
              }}
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
                {/* Search & Filter Bar inside container */}
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button>
                        Add New
                        <ChevronDown className="size-4 ml-1.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                        <Upload className="size-4 mr-2" />
                        Upload Video
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <FolderOpen className="size-4 mr-2" />
                        New Folder
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <DataGridTable />
                <div className="border-t px-4 py-2">
                  <DataGridPagination
                    sizes={[10, 20, 50, 100]}
                    info={`{from} - {to} of ${formatNumber(totalRecords)}`}
                  />
                </div>
              </DataGridContainer>
            </DataGrid>
          </TabsContent>

          <TabsContent value="folders" className="mt-4">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FolderOpen className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No folders yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Create a folder to organize your videos.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Video</DialogTitle>
            <DialogDescription>
              Select a video file to upload for transcoding.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="video-file">Video File</Label>
                <Input
                  id="video-file"
                  type="file"
                  accept="video/*"
                  ref={fileInputRef}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={uploadMutation.isPending}>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Video Detail Dialog */}
      <VideoDetailDialog
        videoId={detailVideoId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
