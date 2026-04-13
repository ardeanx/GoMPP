// Application settings with sensible defaults.
// These are LOCAL UI settings, not backend system settings.

export interface Settings {
  container: 'fixed' | 'fluid';
  layout: {
    sidebar: {
      collapsed: boolean;
    };
  };
  theme: {
    mode: 'light' | 'dark' | 'system';
  };
  locale: {
    language: string;
  };
}

export const APP_SETTINGS: Settings = {
  container: 'fixed',
  layout: {
    sidebar: {
      collapsed: false,
    },
  },
  theme: {
    mode: 'system',
  },
  locale: {
    language: 'en',
  },
};
