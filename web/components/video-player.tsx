'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSystemSettings } from '@/services/settings';
import 'shaka-player/dist/controls.css';
import 'vidstack/styles/base.css';
import 'vidstack/styles/community-skin/video.css';
import 'vidstack/styles/ui/buttons.css';
import 'vidstack/styles/ui/buffering.css';
import 'vidstack/styles/ui/captions.css';
import 'vidstack/styles/ui/menus.css';
import 'vidstack/styles/ui/sliders.css';
import 'vidstack/styles/ui/tooltips.css';

// Caption options

type EdgeStyle = 'none' | 'drop_shadow' | 'depressed' | 'outline' | 'raised';

interface CaptionOptions {
  fontColor: string;
  fontSize: number; // percentage, 100 = default
  bgColor: string;
  bgOpacity: number; // 0–100
  edgeStyle: EdgeStyle;
}

const CAPTION_OPTS_KEY = 'gompp_caption_opts';

const DEFAULT_CAPTION_OPTS: CaptionOptions = {
  fontColor: '#ffffff',
  fontSize: 100,
  bgColor: '#000000',
  bgOpacity: 75,
  edgeStyle: 'none',
};

function loadCaptionOptions(): CaptionOptions {
  try {
    const raw = localStorage.getItem(CAPTION_OPTS_KEY);
    if (raw) return { ...DEFAULT_CAPTION_OPTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_CAPTION_OPTS };
}

function saveCaptionOptions(opts: CaptionOptions) {
  try {
    localStorage.setItem(CAPTION_OPTS_KEY, JSON.stringify(opts));
  } catch {}
}

function hexToRgba(hex: string, opacity: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity / 100})`;
}

function edgeStyleToCSS(style: EdgeStyle, color = 'rgba(0,0,0,0.9)'): string {
  switch (style) {
    case 'drop_shadow':
      return `2px 2px 3px ${color}, 2px 2px 4px ${color}`;
    case 'raised':
      return `1px 1px 0 ${color}, 2px 2px 0 ${color}`;
    case 'depressed':
      return `-1px -1px 0 ${color}, 1px 1px 0 rgba(255,255,255,0.25)`;
    case 'outline':
      return `-1px 0 ${color}, 0 1px ${color}, 1px 0 ${color}, 0 -1px ${color}`;
    default:
      return 'none';
  }
}

// Generate a <style> block for caption overrides inside a player container.
function captionStyleCSS(opts: CaptionOptions, scope: string): string {
  const bg = hexToRgba(opts.bgColor, opts.bgOpacity);
  const edge = edgeStyleToCSS(opts.edgeStyle);
  const scale = opts.fontSize / 100;
  return `
${scope} .shaka-text-container span,
${scope} .shaka-text-container div {
  color: ${opts.fontColor} !important;
  font-size: calc(1em * ${scale}) !important;
  background-color: ${bg} !important;
  text-shadow: ${edge} !important;
}
${scope} video::cue {
  color: ${opts.fontColor};
  font-size: calc(1em * ${scale});
  background-color: ${bg};
  text-shadow: ${edge};
}
${scope} media-player [data-part="cue"] {
  color: ${opts.fontColor} !important;
  font-size: calc(1em * ${scale}) !important;
  background-color: ${bg} !important;
  text-shadow: ${edge} !important;
}
`;
}

// Caption Options Panel

const FONT_COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Yellow', value: '#ffff00' },
  { label: 'Green', value: '#00ff00' },
  { label: 'Cyan', value: '#00ffff' },
  { label: 'Blue', value: '#0000ff' },
  { label: 'Magenta', value: '#ff00ff' },
  { label: 'Red', value: '#ff0000' },
  { label: 'Black', value: '#000000' },
];

const BG_COLORS = [
  { label: 'Black', value: '#000000' },
  { label: 'White', value: '#ffffff' },
  { label: 'Red', value: '#ff0000' },
  { label: 'Blue', value: '#0000ff' },
  { label: 'Green', value: '#00ff00' },
  { label: 'Yellow', value: '#ffff00' },
];

const EDGE_STYLES: { label: string; value: EdgeStyle }[] = [
  { label: 'None', value: 'none' },
  { label: 'Drop Shadow', value: 'drop_shadow' },
  { label: 'Raised', value: 'raised' },
  { label: 'Depressed', value: 'depressed' },
  { label: 'Outline', value: 'outline' },
];

const FONT_SIZES = [
  { label: '50%', value: '50' },
  { label: '75%', value: '75' },
  { label: '100%', value: '100' },
  { label: '150%', value: '150' },
  { label: '200%', value: '200' },
  { label: '300%', value: '300' },
];

const BG_OPACITIES = [
  { label: '0%', value: '0' },
  { label: '25%', value: '25' },
  { label: '50%', value: '50' },
  { label: '75%', value: '75' },
  { label: '100%', value: '100' },
];

const BACK_SVG =
  '<svg viewBox="0 -960 960 960" style="width:20px;height:20px;fill:currentColor;flex-shrink:0;"><path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/></svg>';
const CHEVRON_SVG =
  '<svg viewBox="0 -960 960 960" style="width:18px;height:18px;fill:currentColor;opacity:0.5;flex-shrink:0;"><path d="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z"/></svg>';
const CHECK_SVG =
  '<svg viewBox="0 -960 960 960" style="width:18px;height:18px;fill:currentColor;flex-shrink:0;"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>';

/**
 * Build YouTube-style caption options: But I'm not sure this is working 🤷‍♂️
 *
 * Returns a cleanup function.
 */
function injectCaptionOptionsMenu(
  container: HTMLElement,
  _scopeId: string,
  getOpts: () => CaptionOptions,
  setOpts: (o: CaptionOptions) => void,
): () => void {
  let mainPage: HTMLElement | null = null;
  let detailPage: HTMLElement | null = null;
  let observer: MutationObserver | null = null;
  let showMainPage: (() => void) | null = null;

  // Style constants
  const ROW_CSS =
    'display:flex;align-items:center;justify-content:space-between;padding:10px 16px;cursor:pointer;border:none;background:none;color:#eee;width:100%;font-size:14px;text-align:left;';
  const ROW_HOVER = 'background:rgba(255,255,255,0.1);';
  const HEADER_CSS =
    'display:flex;align-items:center;gap:8px;padding:10px 16px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.1);';
  const HEADER_TITLE_CSS = 'font-size:14px;font-weight:500;color:#eee;';

  // Option definitions for drill-down rows
  interface OptionDef {
    key: keyof CaptionOptions;
    label: string;
    choices: { label: string; value: string }[];
    displayValue: (opts: CaptionOptions) => string;
  }

  const optionDefs: OptionDef[] = [
    {
      key: 'fontColor',
      label: 'Font color',
      choices: FONT_COLORS,
      displayValue: (o) =>
        FONT_COLORS.find((c) => c.value === o.fontColor)?.label ?? o.fontColor,
    },
    {
      key: 'fontSize',
      label: 'Font size',
      choices: FONT_SIZES,
      displayValue: (o) => o.fontSize + '%',
    },
    {
      key: 'bgColor',
      label: 'Background color',
      choices: BG_COLORS,
      displayValue: (o) =>
        BG_COLORS.find((c) => c.value === o.bgColor)?.label ?? o.bgColor,
    },
    {
      key: 'bgOpacity',
      label: 'Background opacity',
      choices: BG_OPACITIES,
      displayValue: (o) => o.bgOpacity + '%',
    },
    {
      key: 'edgeStyle',
      label: 'Character edge style',
      choices: EDGE_STYLES.map((e) => ({ label: e.label, value: e.value })),
      displayValue: (o) =>
        EDGE_STYLES.find((e) => e.value === o.edgeStyle)?.label ?? o.edgeStyle,
    },
  ];

  function addHover(el: HTMLElement) {
    el.addEventListener(
      'mouseenter',
      () => (el.style.background = 'rgba(255,255,255,0.1)'),
    );
    el.addEventListener('mouseleave', () => (el.style.background = 'none'));
  }

  function ensureOptionsLink() {
    const captionsSub = container.querySelector(
      '.shaka-text-languages',
    ) as HTMLElement | null;
    if (!captionsSub) return;

    const backBtn = captionsSub.querySelector(
      '.shaka-back-to-overflow-button',
    ) as HTMLElement | null;
    if (!backBtn) return;
    if (backBtn.querySelector('.gompp-options-link')) return;

    backBtn.style.display = 'flex';
    backBtn.style.alignItems = 'center';
    backBtn.style.width = '100%';

    const link = document.createElement('span');
    link.className = 'gompp-options-link';
    link.textContent = 'Options';
    link.style.cssText =
      'margin-left:auto;cursor:pointer;font-size:13px;color:rgba(255,255,255,0.8);padding:0 8px;';
    link.onclick = (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (showMainPage) showMainPage();
    };
    backBtn.appendChild(link);
  }

  function doInject() {
    const overflow = container.querySelector(
      '.shaka-overflow-menu',
    ) as HTMLElement | null;
    if (!overflow) return false;

    const captionsSub = container.querySelector(
      '.shaka-text-languages',
    ) as HTMLElement | null;
    if (!captionsSub) return false;

    if (container.querySelector('.shaka-caption-options-menu')) {
      ensureOptionsLink();
      return true;
    }

    const parentEl = overflow.parentElement!;

    // ── Main options list page ──
    mainPage = document.createElement('div');
    mainPage.className =
      'shaka-settings-menu shaka-no-propagation shaka-show-controls-on-mouse-over shaka-caption-options-menu';
    mainPage.style.cssText = 'display:none;right:15px;';
    parentEl.appendChild(mainPage);

    detailPage = document.createElement('div');
    detailPage.className =
      'shaka-settings-menu shaka-no-propagation shaka-show-controls-on-mouse-over shaka-caption-detail-page';
    detailPage.style.cssText = 'display:none;right:15px;';
    parentEl.appendChild(detailPage);

    // navigation helpers
    function hideAll() {
      mainPage!.style.display = 'none';
      detailPage!.style.display = 'none';
    }

    function goBackToCaptions() {
      hideAll();
      captionsSub!.style.display = '';
    }

    showMainPage = () => {
      overflow!.style.display = 'none';
      captionsSub!.style.display = 'none';
      hideAll();
      mainPage!.style.display = '';
      renderMainPage();
    };

    function showDetailPage(def: OptionDef) {
      hideAll();
      detailPage!.style.display = '';
      renderDetailPage(def);
    }

    // render the main "Options" list. IDK Guys, let me know how to fix this 🤔
    function renderMainPage() {
      const opts = getOpts();
      mainPage!.innerHTML = '';

      // Header: < Options
      const header = document.createElement('div');
      header.style.cssText = HEADER_CSS;
      header.innerHTML = BACK_SVG;
      const title = document.createElement('span');
      title.textContent = 'Options';
      title.style.cssText = HEADER_TITLE_CSS;
      header.appendChild(title);
      header.onclick = () => goBackToCaptions();
      mainPage!.appendChild(header);

      // Option rows
      for (const def of optionDefs) {
        const row = document.createElement('button');
        row.style.cssText = ROW_CSS;
        addHover(row);

        const label = document.createElement('span');
        label.textContent = def.label;
        row.appendChild(label);

        const right = document.createElement('span');
        right.style.cssText =
          'display:flex;align-items:center;gap:4px;color:rgba(255,255,255,0.6);font-size:13px;';
        right.textContent = def.displayValue(opts);
        right.insertAdjacentHTML('beforeend', CHEVRON_SVG);
        row.appendChild(right);

        row.onclick = () => showDetailPage(def);
        mainPage!.appendChild(row);
      }

      // Reset row
      const resetRow = document.createElement('button');
      resetRow.style.cssText =
        ROW_CSS +
        'color:rgba(255,255,255,0.5);font-size:13px;margin-top:4px;border-top:1px solid rgba(255,255,255,0.08);';
      addHover(resetRow);
      resetRow.textContent = 'Reset to defaults';
      resetRow.onclick = () => {
        setOpts({ ...DEFAULT_CAPTION_OPTS });
        renderMainPage();
      };
      mainPage!.appendChild(resetRow);
    }

    // render a detail page for a single option
    function renderDetailPage(def: OptionDef) {
      const opts = getOpts();
      const currentVal = String(opts[def.key]);
      detailPage!.innerHTML = '';

      // Header: < Option name
      const header = document.createElement('div');
      header.style.cssText = HEADER_CSS;
      header.innerHTML = BACK_SVG;
      const title = document.createElement('span');
      title.textContent = def.label;
      title.style.cssText = HEADER_TITLE_CSS;
      header.appendChild(title);
      header.onclick = () => {
        hideAll();
        mainPage!.style.display = '';
        renderMainPage();
      };
      detailPage!.appendChild(header);

      // Choice rows
      for (const choice of def.choices) {
        const row = document.createElement('button');
        row.style.cssText = ROW_CSS;
        addHover(row);

        const isActive = choice.value === currentVal;

        // Color swatch preview for color options
        if (def.key === 'fontColor' || def.key === 'bgColor') {
          const swatch = document.createElement('span');
          swatch.style.cssText = `display:inline-block;width:14px;height:14px;border-radius:3px;background:${choice.value};border:1px solid rgba(255,255,255,0.3);margin-right:10px;flex-shrink:0;vertical-align:middle;`;
          row.appendChild(swatch);
        }

        const label = document.createElement('span');
        label.textContent = choice.label;
        label.style.cssText = 'flex:1;';
        row.appendChild(label);

        if (isActive) {
          const check = document.createElement('span');
          check.innerHTML = CHECK_SVG;
          check.style.cssText = 'flex-shrink:0;margin-left:8px;';
          row.appendChild(check);
        }

        row.onclick = () => {
          const fresh = getOpts();
          const val =
            def.key === 'fontSize' || def.key === 'bgOpacity'
              ? Number(choice.value)
              : choice.value;
          setOpts({ ...fresh, [def.key]: val } as CaptionOptions);
          renderDetailPage(def);
        };

        detailPage!.appendChild(row);
      }
    }

    ensureOptionsLink();
    return true;
  }

  doInject();

  // Persistent observer
  observer = new MutationObserver(() => {
    const captionsSub = container.querySelector('.shaka-text-languages');
    if (captionsSub) {
      ensureOptionsLink();
    } else if (!container.querySelector('.shaka-caption-options-menu')) {
      doInject();
    }
  });
  observer.observe(container, { childList: true, subtree: true });

  return () => {
    if (observer) observer.disconnect();
    if (mainPage) mainPage.remove();
    if (detailPage) detailPage.remove();
    const link = container.querySelector('.gompp-options-link');
    if (link) link.remove();
  };
}

// Settings helpers

type SettingsArray = Array<{ key: string; value: unknown }>;

function getSetting(
  settings: SettingsArray,
  key: string,
  fallback = '',
): string {
  const entry = settings.find((s) => s.key === key);
  if (entry == null) return fallback;
  return String(entry.value ?? fallback);
}

function getBoolSetting(
  settings: SettingsArray,
  key: string,
  fallback = true,
): boolean {
  const entry = settings.find((s) => s.key === key);
  if (entry == null) return fallback;
  return entry.value === true || entry.value === 'true';
}

// Resumable playback helpers

const RESUME_PREFIX = 'gompp_resume_';

function savePlaybackPosition(src: string, time: number) {
  try {
    localStorage.setItem(RESUME_PREFIX + src, String(time));
  } catch {
    /* quota exceeded */
  }
}

function getPlaybackPosition(src: string): number {
  try {
    return parseFloat(localStorage.getItem(RESUME_PREFIX + src) || '0') || 0;
  } catch {
    return 0;
  }
}

// Buffering strategy → Shaka streaming config

function getBufferingConfig(strategy: string) {
  switch (strategy) {
    case 'aggressive':
      return { bufferingGoal: 60, rebufferingGoal: 1 };
    case 'conservative':
      return { bufferingGoal: 15, rebufferingGoal: 4 };
    default: // balanced
      return { bufferingGoal: 30, rebufferingGoal: 2 };
  }
}

// Playback speed options

function getPlaybackRates(option: string): number[] {
  switch (option) {
    case 'minimal':
      return [0.5, 1, 2];
    case 'full':
      return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
    default: // medium
      return [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  }
}

// Default quality → Shaka ABR restriction

function getQualityRestrictions(quality: string): { maxHeight?: number } {
  switch (quality) {
    case '360p':
      return { maxHeight: 360 };
    case '480p':
      return { maxHeight: 480 };
    case '720p':
      return { maxHeight: 720 };
    case '1080p':
      return { maxHeight: 1080 };
    case '2160p':
      return { maxHeight: 2160 };
    default: // auto
      return {};
  }
}

// Types

interface SubtitleTrackInfo {
  id: string;
  language: string;
  label: string;
  format: string;
  url: string;
}

function subtitleMimeType(format: string): string {
  switch (format) {
    case 'vtt':
      return 'text/vtt';
    case 'srt':
      return 'text/srt';
    case 'ass':
    case 'ssa':
      return 'text/x-ssa';
    default:
      return 'text/vtt';
  }
}

interface VideoPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  className?: string;
  subtitles?: SubtitleTrackInfo[];
}

// Shaka Player Component

function ShakaPlayerComponent({
  src,
  title,
  poster,
  className,
  settings,
  subtitles,
}: VideoPlayerProps & { settings: SettingsArray }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<unknown>(null);
  const scopeId = useRef(`gompp-cap-${Math.random().toString(36).slice(2, 8)}`);
  const captionOptsRef = useRef<CaptionOptions>(loadCaptionOptions());
  const [captionOpts, setCaptionOpts] = useState<CaptionOptions>(
    captionOptsRef.current,
  );

  const handleCaptionChange = useCallback((next: CaptionOptions) => {
    captionOptsRef.current = next;
    setCaptionOpts(next);
    saveCaptionOptions(next);
  }, []);

  // Apply caption styles directly to Shaka's text container elements.
  // Shaka dynamically creates/destroys DOM elements for each cue and sets
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function applyStylesToTextContainer() {
      const opts = captionOptsRef.current;
      const bg = hexToRgba(opts.bgColor, opts.bgOpacity);
      const edge = edgeStyleToCSS(opts.edgeStyle);
      const scale = opts.fontSize / 100;
      const textContainer = container!.querySelector('.shaka-text-container');
      if (!textContainer) return;
      // Apply to all nested elements inside the text container
      const els = textContainer.querySelectorAll('*');
      for (const el of els) {
        const s = (el as HTMLElement).style;
        s.setProperty('color', opts.fontColor, 'important');
        s.setProperty('text-shadow', edge, 'important');
        // Only set font-size and background on text-bearing spans
        if (el.tagName === 'SPAN') {
          s.setProperty('font-size', `calc(1em * ${scale})`, 'important');
          s.setProperty('background-color', bg, 'important');
        }
      }
    }

    // Apply immediately and observe for new cue elements
    applyStylesToTextContainer();

    const obs = new MutationObserver(() => applyStylesToTextContainer());
    obs.observe(container, { childList: true, subtree: true });

    return () => obs.disconnect();
  }, [captionOpts]);

  const autoplay = getBoolSetting(settings, 'player_autoplay', false);
  const resumable = getBoolSetting(settings, 'player_resumable', false);
  const themeColor = getSetting(settings, 'player_theme_color', '#0011ff');
  const preload = getSetting(settings, 'player_preload', 'auto');
  const bufferingStrategy = getSetting(
    settings,
    'player_buffering_strategy',
    'balanced',
  );
  const defaultQuality = getSetting(settings, 'player_default_quality', 'auto');
  const speedOptions = getSetting(settings, 'player_speed_options', 'medium');

  // Save position on unmount / periodically
  const savePosition = useCallback(() => {
    if (!resumable) return;
    const videoEl = videoRef.current;
    if (videoEl && videoEl.currentTime > 5) {
      savePlaybackPosition(src, videoEl.currentTime);
    }
  }, [resumable, src]);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      const shaka = (await import('shaka-player/dist/shaka-player.ui')).default;
      if (destroyed) return;

      shaka.polyfill.installAll();
      if (!shaka.Player.isBrowserSupported()) return;

      const videoEl = videoRef.current;
      const containerEl = containerRef.current;
      if (!videoEl || !containerEl) return;

      const player = new shaka.Player();
      await player.attach(videoEl);
      playerRef.current = player;

      const ui = new shaka.ui.Overlay(player, containerEl, videoEl);

      // Build control panel elements from settings
      const controlPanelElements: string[] = [];

      if (getBoolSetting(settings, 'ctrl_play_pause'))
        controlPanelElements.push('play_pause');
      if (getBoolSetting(settings, 'ctrl_backward'))
        controlPanelElements.push('rewind');
      if (getBoolSetting(settings, 'ctrl_forward'))
        controlPanelElements.push('fast_forward');
      if (getBoolSetting(settings, 'ctrl_volume'))
        controlPanelElements.push('mute', 'volume');
      if (getBoolSetting(settings, 'ctrl_current_time'))
        controlPanelElements.push('time_and_duration');

      controlPanelElements.push('spacer');

      if (getBoolSetting(settings, 'ctrl_subtitles'))
        controlPanelElements.push('captions');
      if (getBoolSetting(settings, 'ctrl_chromecast'))
        controlPanelElements.push('cast');
      if (getBoolSetting(settings, 'ctrl_airplay'))
        controlPanelElements.push('airplay');
      if (getBoolSetting(settings, 'ctrl_settings'))
        controlPanelElements.push('overflow_menu');
      if (getBoolSetting(settings, 'ctrl_pip'))
        controlPanelElements.push('picture_in_picture');
      if (getBoolSetting(settings, 'ctrl_fullscreen'))
        controlPanelElements.push('fullscreen');

      // Build overflow menu buttons
      const overflowMenuButtons: string[] = [
        'quality',
        'language',
        'playback_rate',
        'captions',
      ];

      const uiConfig: Record<string, unknown> = {
        controlPanelElements,
        overflowMenuButtons,
        seekBarColors: {
          base: 'rgba(255,255,255,0.3)',
          buffered: 'rgba(255,255,255,0.54)',
          played: themeColor,
        },
        bigButtons: getBoolSetting(settings, 'ctrl_big_play')
          ? ['play_pause']
          : [],
        addSeekBar: getBoolSetting(settings, 'ctrl_progress_bar'),
        playbackRates: getPlaybackRates(speedOptions),
      };

      ui.configure(uiConfig);

      // Inject caption options into Shaka's overflow menu
      const cleanupCaptionMenu = injectCaptionOptionsMenu(
        containerEl,
        scopeId.current,
        () => captionOptsRef.current,
        handleCaptionChange,
      );
      (containerEl as unknown as Record<string, unknown>).__cleanupCaptionMenu =
        cleanupCaptionMenu();

      // Player configuration (streaming, ABR, quality restrictions)
      const { bufferingGoal, rebufferingGoal } =
        getBufferingConfig(bufferingStrategy);
      const qualityRestrictions = getQualityRestrictions(defaultQuality);

      const playerConfig: Record<string, unknown> = {
        streaming: { bufferingGoal, rebufferingGoal },
      };
      if (qualityRestrictions.maxHeight) {
        playerConfig.abr = {
          restrictions: { maxHeight: qualityRestrictions.maxHeight },
        };
      }
      player.configure(playerConfig);

      try {
        await player.load(src);

        // Add subtitle tracks after loading
        if (subtitles && subtitles.length > 0) {
          for (const track of subtitles) {
            try {
              await (player as any).addTextTrackAsync(
                track.url,
                track.language,
                'subtitle',
                subtitleMimeType(track.format),
                '',
                track.label,
              );
            } catch (e) {
              console.warn('Failed to add subtitle track:', track.label, e);
            }
          }
        }

        // Resume position
        if (resumable) {
          const pos = getPlaybackPosition(src);
          if (pos > 5) {
            videoEl.currentTime = pos;
          }
        }
      } catch (e) {
        console.error('Shaka load error:', e);
      }

      // Periodically save position for resumable playback
      if (resumable) {
        const interval = setInterval(() => {
          if (videoEl && videoEl.currentTime > 5 && !videoEl.paused) {
            savePlaybackPosition(src, videoEl.currentTime);
          }
        }, 5000);
        videoEl.addEventListener('pause', () =>
          savePlaybackPosition(src, videoEl.currentTime),
        );
        videoEl.addEventListener('ended', () => {
          try {
            localStorage.removeItem(RESUME_PREFIX + src);
          } catch {}
        });
        // Store interval for cleanup
        (videoEl as unknown as Record<string, unknown>).__resumeInterval =
          interval;
      }
    }

    init();

    return () => {
      destroyed = true;
      savePosition();
      const containerEl = containerRef.current;
      if (containerEl) {
        const cleanupMenu = (containerEl as unknown as Record<string, unknown>)
          .__cleanupCaptionMenu as (() => void) | undefined;
        if (cleanupMenu) cleanupMenu();
      }
      const videoEl = videoRef.current;
      if (videoEl) {
        const interval = (videoEl as unknown as Record<string, unknown>)
          .__resumeInterval as ReturnType<typeof setInterval> | undefined;
        if (interval) clearInterval(interval);
      }
      const p = playerRef.current as { destroy?: () => void } | null;
      if (p?.destroy) {
        p.destroy();
        playerRef.current = null;
      }
    };
  }, [
    src,
    settings,
    themeColor,
    resumable,
    bufferingStrategy,
    defaultQuality,
    speedOptions,
    savePosition,
    subtitles,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-shaka-player-container
      id={scopeId.current}
      style={{ position: 'relative' }}
    >
      <style>{captionStyleCSS(captionOpts, `#${scopeId.current}`)}</style>
      <video
        ref={videoRef}
        data-shaka-player
        autoPlay={autoplay}
        playsInline
        preload={preload as 'auto' | 'metadata' | 'none'}
        poster={poster}
        title={title}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
}

// Vidstack Player Component

function VidstackPlayerComponent({
  src,
  title,
  poster,
  className,
  settings,
  subtitles,
}: VideoPlayerProps & { settings: SettingsArray }) {
  const themeColor = getSetting(settings, 'player_theme_color', '#0011ff');
  const autoplay = getBoolSetting(settings, 'player_autoplay', false);
  const resumable = getBoolSetting(settings, 'player_resumable', false);
  const preload = getSetting(settings, 'player_preload', 'auto');

  const containerRef = useRef<HTMLDivElement>(null);
  const vidstackRef = useRef<HTMLDivElement>(null);
  const scopeId = useRef(
    `gompp-vcap-${Math.random().toString(36).slice(2, 8)}`,
  );
  const [captionOpts] = useState<CaptionOptions>(loadCaptionOptions);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      await import('vidstack/define/media-player.js');
      await import('vidstack/define/media-outlet.js');
      await import('vidstack/define/media-community-skin.js');

      if (destroyed || !vidstackRef.current) return;

      const mediaPlayer = document.createElement('media-player') as HTMLElement;
      mediaPlayer.setAttribute('src', src);
      if (title) mediaPlayer.setAttribute('title', title);
      if (poster) mediaPlayer.setAttribute('poster', poster);
      if (autoplay) mediaPlayer.setAttribute('autoplay', '');
      mediaPlayer.setAttribute('playsinline', '');
      mediaPlayer.setAttribute('preload', preload);

      // Build CSS custom properties for theming and hide controls via CSS
      let cssVars = `width:100%;height:100%;--media-brand:${themeColor}`;
      if (!getBoolSetting(settings, 'ctrl_big_play', true))
        cssVars += ';--media-play-button-display:none';

      mediaPlayer.style.cssText = cssVars;

      const provider = document.createElement('media-outlet');
      mediaPlayer.appendChild(provider);

      // Add subtitle tracks
      if (subtitles && subtitles.length > 0) {
        for (const track of subtitles) {
          const trackEl = document.createElement('track');
          trackEl.src = track.url;
          trackEl.kind = 'subtitles';
          trackEl.srclang = track.language;
          trackEl.label = track.label;
          provider.appendChild(trackEl);
        }
      }

      const skin = document.createElement('media-community-skin');
      mediaPlayer.appendChild(skin);

      vidstackRef.current.innerHTML = '';
      vidstackRef.current.appendChild(mediaPlayer);

      // Resumable playback
      if (resumable) {
        const pos = getPlaybackPosition(src);
        const vid = mediaPlayer.querySelector('video');
        if (vid && pos > 5) {
          vid.addEventListener(
            'loadedmetadata',
            () => {
              vid.currentTime = pos;
            },
            { once: true },
          );
        }

        // Save position periodically
        const interval = setInterval(() => {
          const v = mediaPlayer.querySelector('video');
          if (v && v.currentTime > 5 && !v.paused) {
            savePlaybackPosition(src, v.currentTime);
          }
        }, 5000);

        (mediaPlayer as unknown as Record<string, unknown>).__resumeInterval =
          interval;
      }
    }

    init();

    return () => {
      destroyed = true;
      if (vidstackRef.current) {
        const mp = vidstackRef.current.querySelector('media-player');
        if (mp) {
          const interval = (mp as unknown as Record<string, unknown>)
            .__resumeInterval as ReturnType<typeof setInterval> | undefined;
          if (interval) clearInterval(interval);
          const vid = mp.querySelector('video');
          if (vid && resumable && vid.currentTime > 5) {
            savePlaybackPosition(src, vid.currentTime);
          }
        }
        vidstackRef.current.innerHTML = '';
      }
    };
  }, [
    src,
    title,
    poster,
    autoplay,
    themeColor,
    resumable,
    preload,
    settings,
    subtitles,
  ]);

  return (
    <div
      ref={containerRef}
      className={className}
      id={scopeId.current}
      style={{ position: 'relative' }}
    >
      <style>{captionStyleCSS(captionOpts, `#${scopeId.current}`)}</style>

      <div ref={vidstackRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}

// Embed-based Player (uses Go embed handler via iframe)

function EmbedPlayer({
  videoId,
  className,
}: {
  videoId: string;
  className?: string;
}) {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ||
    'http://localhost:8080';
  return (
    <iframe
      src={`${apiBase}/embed/${videoId}`}
      className={className}
      style={{ width: '100%', height: '100%', border: 'none' }}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
    />
  );
}

// Main Export

export function VideoPlayer(props: VideoPlayerProps) {
  const { data } = useSystemSettings();
  const settings = data?.data ?? [];
  const playerType = getSetting(settings, 'player_type', 'shaka');

  if (playerType === 'vidstack') {
    return <VidstackPlayerComponent {...props} settings={settings} />;
  }

  return <ShakaPlayerComponent {...props} settings={settings} />;
}

/** Embeds a video using the backend embed player (settings-aware, iframe-based) */
export function VideoEmbed({
  videoId,
  className,
}: {
  videoId: string;
  className?: string;
}) {
  return <EmbedPlayer videoId={videoId} className={className} />;
}
