'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Globe,
  MonitorSmartphone,
  MoreVertical,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useAnalyticsOverview,
  useDeviceTypes,
  useTopVideos,
  useTrafficSeries,
} from '@/services/analytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Toolbar,
  ToolbarHeading,
} from '@/components/layouts/main/components/toolbar';

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/* Color palette for device type chart */
const DEVICE_COLORS = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#6366f1',
  '#eab308',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
  '#8b5cf6',
  '#06b6d4',
];

const trafficChartConfig: ChartConfig = {
  value: {
    label: 'Traffic',
    color: 'var(--color-primary)',
  },
};

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d');
  const [showBandwidth, setShowBandwidth] = useState(false);

  const { data: overview, isLoading: overviewLoading } =
    useAnalyticsOverview(period);
  const { data: trafficData, isLoading: trafficLoading } = useTrafficSeries(
    period,
    'day',
  );
  const { data: topVideosData } = useTopVideos(period, 10);
  const { data: deviceData, isLoading: deviceLoading } = useDeviceTypes(period);

  const stats = overview?.data;
  const trafficSeries = trafficData?.data ?? [];

  // Build traffic chart data from real API
  const chartData = useMemo(
    () =>
      trafficSeries.map((d) => ({
        month: new Date(d.date).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        value: showBandwidth ? d.bandwidth : d.views,
      })),
    [trafficSeries, showBandwidth],
  );

  // Build device type chart data from real API
  const deviceChartData = useMemo(() => {
    const raw = deviceData?.data ?? [];
    return raw.map((d, i) => ({
      name: d.device_type,
      value: d.count,
      fill: DEVICE_COLORS[i % DEVICE_COLORS.length],
    }));
  }, [deviceData]);

  const deviceChartConfig: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        deviceChartData.map((d) => [d.name, { label: d.name, color: d.fill }]),
      ),
    [deviceChartData],
  );

  const statCards = [
    {
      label: 'Total Videos',
      value: stats ? formatNumber(stats.total_videos) : '—',
      icon: <TrendingUp className="size-4" />,
      iconBg: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Total Views',
      value: stats ? formatNumber(stats.total_views) : '—',
      icon: <CheckCircle2 className="size-4" />,
      iconBg: 'bg-green-100 text-green-600',
    },
    {
      label: 'Active Jobs',
      value: stats ? formatNumber(stats.active_jobs) : '—',
      icon: <Zap className="size-4" />,
      iconBg: 'bg-red-100 text-red-500',
    },
    {
      label: 'Storage Used',
      value: stats ? formatBytes(stats.storage_used_bytes) : '—',
      icon: <Clock className="size-4" />,
      iconBg: 'bg-purple-100 text-purple-500',
    },
  ];

  return (
    <>
      <Toolbar>
        <ToolbarHeading title="Analytics" />
      </Toolbar>

      <div className="container space-y-6">
        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {overviewLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))
            : statCards.map((card) => (
                <Card key={card.label}>
                  <CardContent className="pt-6">
                    <div
                      className={`inline-flex items-center justify-center size-10 rounded-lg ${card.iconBg} mb-3`}
                    >
                      {card.icon}
                    </div>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {card.label}
                    </p>
                  </CardContent>
                </Card>
              ))}
        </div>

        {/* Highlights + Traffic */}
        <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
          {/* Highlights */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Highlights</CardTitle>
              <Button variant="ghost" mode="icon" size="sm">
                <MoreVertical className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Total Bandwidth
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold">
                    {stats ? formatBytes(stats.total_bandwidth_bytes) : '—'}
                  </span>
                </div>
              </div>

              {/* Stacked bar */}
              <div className="flex h-2.5 w-full rounded-full overflow-hidden">
                <div className="bg-emerald-500" style={{ width: '40%' }} />
                <div className="bg-orange-400" style={{ width: '35%' }} />
                <div className="bg-indigo-500" style={{ width: '25%' }} />
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Videos
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-orange-400" />
                  Views
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-indigo-500" />
                  Jobs
                </span>
              </div>

              {/* Metric rows */}
              <div className="space-y-0 divide-y">
                <div className="flex items-center justify-between py-3 first:pt-0">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
                      <MonitorSmartphone className="size-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm">Total Videos</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats ? formatNumber(stats.total_videos) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
                      <Globe className="size-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm">Total Views</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats ? formatNumber(stats.total_views) : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-3 last:pb-0">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center size-8 rounded-lg bg-muted">
                      <CheckCircle2 className="size-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm">Active Jobs</span>
                  </div>
                  <span className="text-sm font-medium">
                    {stats ? formatNumber(stats.active_jobs) : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Traffic chart */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Traffic</CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Bandwidth
                  </span>
                  <Switch
                    checked={showBandwidth}
                    onCheckedChange={setShowBandwidth}
                  />
                </div>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">7 days</SelectItem>
                    <SelectItem value="30d">30 days</SelectItem>
                    <SelectItem value="90d">12 months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {trafficLoading ? (
                <Skeleton className="h-72 w-full rounded-lg" />
              ) : (
                <ChartContainer
                  config={trafficChartConfig}
                  className="h-72 w-full"
                >
                  <AreaChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--border)"
                    />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) =>
                        showBandwidth
                          ? formatBytes(v)
                          : v >= 1000
                            ? `${v / 1000}k`
                            : String(v)
                      }
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value: number) =>
                            showBandwidth
                              ? formatBytes(value)
                              : formatNumber(value)
                          }
                        />
                      }
                    />
                    <defs>
                      <linearGradient
                        id="trafficFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="var(--color-value)"
                          stopOpacity={0.2}
                        />
                        <stop
                          offset="100%"
                          stopColor="var(--color-value)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="var(--color-value)"
                      fill="url(#trafficFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom: Table + Device Type */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Videos table */}
          <Card>
            <CardHeader>
              <CardTitle>Top Videos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Video</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Bandwidth</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(topVideosData?.data ?? []).length > 0 ? (
                    topVideosData!.data.map((row) => (
                      <TableRow key={row.video_id}>
                        <TableCell>
                          <p className="font-semibold truncate max-w-[200px]">
                            {row.title}
                          </p>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatNumber(row.view_count)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatBytes(row.bandwidth_bytes)}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="text-center text-muted-foreground py-8"
                      >
                        No video analytics data yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Device Type */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Device Type</CardTitle>
              <Button variant="ghost" mode="icon" size="sm">
                <MoreVertical className="size-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {deviceLoading ? (
                <Skeleton className="h-52 w-full rounded-lg" />
              ) : deviceChartData.length > 0 ? (
                <div className="flex items-center justify-center gap-8">
                  <ChartContainer
                    config={deviceChartConfig}
                    className="h-52 w-52"
                  >
                    <PieChart>
                      <Pie
                        data={deviceChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        strokeWidth={0}
                      >
                        {deviceChartData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>

                  <div className="space-y-3">
                    {deviceChartData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2.5">
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: d.fill }}
                        />
                        <span className="text-sm">{d.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-52 text-muted-foreground text-sm">
                  No device analytics data yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
