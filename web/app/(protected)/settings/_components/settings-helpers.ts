// Shared helpers & types for settings tab components

export interface SettingsTabProps {
  edits: Record<string, string>;
  setField: (key: string, value: string) => void;
  setBoolField: (key: string, value: boolean) => void;
}

export function getVal(
  edits: Record<string, string>,
  key: string,
  fallback = '',
): string {
  return edits[key] ?? fallback;
}

export function getBool(edits: Record<string, string>, key: string): boolean {
  const v = edits[key];
  return v === 'true' || v === '1';
}
