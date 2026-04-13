'use client';

import {
  Captions,
  Cast,
  CirclePlay,
  Download,
  Film,
  Forward,
  Fullscreen,
  Gauge,
  Maximize,
  MonitorPlay,
  Palette,
  Pause,
  PictureInPicture,
  Play,
  Rewind,
  Server,
  Settings as SettingsIcon,
  ShieldBan,
  Subtitles,
  Timer,
  Volume2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getBool, getVal, type SettingsTabProps } from './settings-helpers';

export function PlayerSettingsTab({
  edits,
  setField,
  setBoolField,
}: SettingsTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Left — Player Config */}
      <Card>
        <CardHeader>
          <CardTitle>Player Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 divide-y">
          {/* Default Video Player */}
          <div className="flex items-center justify-between py-4 first:pt-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <MonitorPlay className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Default Video Player</p>
                <p className="text-xs text-muted-foreground">
                  Default Video Player for the System
                </p>
              </div>
            </div>
            <Select
              value={getVal(edits, 'player_type', 'vidstack')}
              onValueChange={(v) => setField('player_type', v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shaka">Shaka Player</SelectItem>
                <SelectItem value="vidstack">Vidstack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Video Player Theme */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <Palette className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Video Player Theme</p>
                <p className="text-xs text-muted-foreground">
                  Video Player Theme Display
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={getVal(edits, 'player_theme_color', '#0011ff')}
                onChange={(e) => setField('player_theme_color', e.target.value)}
                className="size-8 rounded border border-border cursor-pointer p-0.5"
              />
              <Input
                value={getVal(edits, 'player_theme_color', '#0011ff')}
                onChange={(e) => setField('player_theme_color', e.target.value)}
                className="w-28 uppercase"
                placeholder="#0011ff"
              />
            </div>
          </div>

          {/* Autoplay */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <Play className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Autoplay</p>
                <p className="text-xs text-muted-foreground">
                  Wether the video play automatically or not
                </p>
              </div>
            </div>
            <Switch
              checked={getBool(edits, 'player_autoplay')}
              onCheckedChange={(v) => setBoolField('player_autoplay', v)}
            />
          </div>

          {/* Resumable Player Position */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <Rewind className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Resumable Player Position</p>
                <p className="text-xs text-muted-foreground">
                  Wether the Video Player Position is Resumable or not
                </p>
              </div>
            </div>
            <Switch
              checked={getBool(edits, 'player_resumable')}
              onCheckedChange={(v) => setBoolField('player_resumable', v)}
            />
          </div>

          {/* AdBlocker Detector */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <ShieldBan className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">AdBlocker Detector</p>
                <p className="text-xs text-muted-foreground">
                  If this active, user with Adblocker can not watch the video
                </p>
              </div>
            </div>
            <Switch
              checked={getBool(edits, 'player_adblocker_detection')}
              onCheckedChange={(v) =>
                setBoolField('player_adblocker_detection', v)
              }
            />
          </div>

          {/* IDM Detector */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <Download className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">IDM Detector</p>
                <p className="text-xs text-muted-foreground">
                  To Detect if the user have IDM and the system will prompt
                  alert
                </p>
              </div>
            </div>
            <Switch
              checked={getBool(edits, 'player_idm_detection')}
              onCheckedChange={(v) => setBoolField('player_idm_detection', v)}
            />
          </div>

          {/* Caption Appearance */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <Captions className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Caption Appearance</p>
                <p className="text-xs text-muted-foreground">
                  Customize the Subtitle or Caption Appearance
                </p>
              </div>
            </div>
            <Button variant="ghost" mode="icon" size="sm">
              <SettingsIcon className="size-4" />
            </Button>
          </div>

          {/* Default Video Quality */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <Film className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Default Video Quality</p>
                <p className="text-xs text-muted-foreground">
                  Default quality for the video player
                </p>
              </div>
            </div>
            <Select
              value={getVal(edits, 'player_default_quality', '1080p')}
              onValueChange={(v) => setField('player_default_quality', v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="2160p">2160p</SelectItem>
                <SelectItem value="1080p">1080p</SelectItem>
                <SelectItem value="720p">720p</SelectItem>
                <SelectItem value="480p">480p</SelectItem>
                <SelectItem value="360p">360p</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Buffering Strategy */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <Gauge className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Buffering Strategy</p>
                <p className="text-xs text-muted-foreground">
                  Strategy to buffer the video
                </p>
              </div>
            </div>
            <Select
              value={getVal(edits, 'player_buffering_strategy', 'balanced')}
              onValueChange={(v) => setField('player_buffering_strategy', v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aggressive">Aggressive</SelectItem>
                <SelectItem value="balanced">Balanced</SelectItem>
                <SelectItem value="conservative">Conservative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preload Behavior */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <Zap className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Preload Behavior</p>
                <p className="text-xs text-muted-foreground">
                  If you don&apos;t know what it is just select auto
                </p>
              </div>
            </div>
            <Select
              value={getVal(edits, 'player_preload', 'auto')}
              onValueChange={(v) => setField('player_preload', v)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metadata">Metadata</SelectItem>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Playback Speed Options */}
          <div className="flex items-center justify-between py-4 last:pb-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-9 rounded-lg bg-muted shrink-0">
                <Forward className="size-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Playback Speed Options</p>
                <p className="text-xs text-muted-foreground">
                  Video Player Playback Speed Options
                </p>
              </div>
            </div>
            <Select
              value={getVal(edits, 'player_speed_options', 'medium')}
              onValueChange={(v) => setField('player_speed_options', v)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">Minimal (0.5×, 1×, 2×)</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="full">Full (0.25× – 3×)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Right — Player Controls */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Player Controls</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Enable All Function
            </span>
            <Switch
              checked={getBool(edits, 'player_all_controls')}
              onCheckedChange={(v) => {
                setBoolField('player_all_controls', v);
                const controlKeys = [
                  'ctrl_play_pause',
                  'ctrl_volume',
                  'ctrl_fullscreen',
                  'ctrl_progress_bar',
                  'ctrl_subtitles',
                  'ctrl_settings',
                  'ctrl_airplay',
                  'ctrl_chromecast',
                  'ctrl_duration',
                  'ctrl_current_time',
                  'ctrl_pip',
                  'ctrl_big_play',
                  'ctrl_forward',
                  'ctrl_backward',
                  'ctrl_opensubtitle',
                  'ctrl_server_selection',
                  'ctrl_watch_party',
                ];
                controlKeys.forEach((k) => setBoolField(k, v));
              }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="grid grid-cols-2 gap-x-4">
            {/* Row 1 */}
            <div className="flex items-center gap-3 border-b py-3">
              <Play className="size-4 text-primary shrink-0" />
              <span className="text-sm flex-1">
                Show Play &amp; Pause Button
              </span>
              <Switch
                checked={getBool(edits, 'ctrl_play_pause')}
                onCheckedChange={(v) => setBoolField('ctrl_play_pause', v)}
              />
            </div>
            <div className="flex items-center gap-3 border-b py-3">
              <Volume2 className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Show Volume Control</span>
              <Switch
                checked={getBool(edits, 'ctrl_volume')}
                onCheckedChange={(v) => setBoolField('ctrl_volume', v)}
              />
            </div>

            {/* Row 2 */}
            <div className="flex items-center gap-3 border-b py-3">
              <Maximize className="size-4 text-primary shrink-0" />
              <span className="text-sm flex-1">Enable Fullscreen Button</span>
              <Switch
                checked={getBool(edits, 'ctrl_fullscreen')}
                onCheckedChange={(v) => setBoolField('ctrl_fullscreen', v)}
              />
            </div>
            <div className="flex items-center gap-3 border-b py-3">
              <Gauge className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Show Progress Bar</span>
              <Switch
                checked={getBool(edits, 'ctrl_progress_bar')}
                onCheckedChange={(v) => setBoolField('ctrl_progress_bar', v)}
              />
            </div>

            {/* Row 3 */}
            <div className="flex items-center gap-3 border-b py-3">
              <Subtitles className="size-4 text-primary shrink-0" />
              <span className="text-sm flex-1">Enable Subtitles</span>
              <Switch
                checked={getBool(edits, 'ctrl_subtitles')}
                onCheckedChange={(v) => setBoolField('ctrl_subtitles', v)}
              />
            </div>
            <div className="flex items-center gap-3 border-b py-3">
              <SettingsIcon className="size-4 text-primary shrink-0" />
              <span className="text-sm flex-1">Enable settings Button</span>
              <Switch
                checked={getBool(edits, 'ctrl_settings')}
                onCheckedChange={(v) => setBoolField('ctrl_settings', v)}
              />
            </div>

            {/* Row 4 */}
            <div className="flex items-center gap-3 border-b py-3">
              <MonitorPlay className="size-4 text-primary shrink-0" />
              <span className="text-sm flex-1">Enable Airplay Button</span>
              <Switch
                checked={getBool(edits, 'ctrl_airplay')}
                onCheckedChange={(v) => setBoolField('ctrl_airplay', v)}
              />
            </div>
            <div className="flex items-center gap-3 border-b py-3">
              <Cast className="size-4 text-primary shrink-0" />
              <span className="text-sm flex-1">Enable Chromecast Button</span>
              <Switch
                checked={getBool(edits, 'ctrl_chromecast')}
                onCheckedChange={(v) => setBoolField('ctrl_chromecast', v)}
              />
            </div>

            {/* Row 5 */}
            <div className="flex items-center gap-3 border-b py-3">
              <Timer className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Show Duration</span>
              <Switch
                checked={getBool(edits, 'ctrl_duration')}
                onCheckedChange={(v) => setBoolField('ctrl_duration', v)}
              />
            </div>
            <div className="flex items-center gap-3 border-b py-3">
              <Timer className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Show Current Time</span>
              <Switch
                checked={getBool(edits, 'ctrl_current_time')}
                onCheckedChange={(v) => setBoolField('ctrl_current_time', v)}
              />
            </div>

            {/* Row 6 */}
            <div className="flex items-center gap-3 border-b py-3">
              <PictureInPicture className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Enable PIP Button</span>
              <Switch
                checked={getBool(edits, 'ctrl_pip')}
                onCheckedChange={(v) => setBoolField('ctrl_pip', v)}
              />
            </div>
            <div className="flex items-center gap-3 border-b py-3">
              <CirclePlay className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Show Big Play Button</span>
              <Switch
                checked={getBool(edits, 'ctrl_big_play')}
                onCheckedChange={(v) => setBoolField('ctrl_big_play', v)}
              />
            </div>

            {/* Row 7 */}
            <div className="flex items-center gap-3 border-b py-3">
              <Forward className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">10s Forward Buttons</span>
              <Switch
                checked={getBool(edits, 'ctrl_forward')}
                onCheckedChange={(v) => setBoolField('ctrl_forward', v)}
              />
            </div>
            <div className="flex items-center gap-3 border-b py-3">
              <Rewind className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">10s Backwards Buttons</span>
              <Switch
                checked={getBool(edits, 'ctrl_backward')}
                onCheckedChange={(v) => setBoolField('ctrl_backward', v)}
              />
            </div>

            {/* Row 8 */}
            <div className="flex items-center gap-3 border-b py-3">
              <Captions className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Show Opensubtitle</span>
              <Switch
                checked={getBool(edits, 'ctrl_opensubtitle')}
                onCheckedChange={(v) => setBoolField('ctrl_opensubtitle', v)}
              />
            </div>
            <div className="flex items-center gap-3 border-b py-3">
              <Server className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Show server Selection</span>
              <Switch
                checked={getBool(edits, 'ctrl_server_selection')}
                onCheckedChange={(v) =>
                  setBoolField('ctrl_server_selection', v)
                }
              />
            </div>

            {/* Row 9 — single item */}
            <div className="flex items-center gap-3 py-3">
              <Film className="size-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1">Enable Watch Party</span>
              <Switch
                checked={getBool(edits, 'ctrl_watch_party')}
                onCheckedChange={(v) => setBoolField('ctrl_watch_party', v)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
