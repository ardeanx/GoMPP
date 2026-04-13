'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { getBool, getVal, type SettingsTabProps } from './settings-helpers';

export function TranscribingSettingsTab({
  edits,
  setField,
  setBoolField,
}: SettingsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Transcribing Settings</CardTitle>
        <CardDescription>
          Configure speech-to-text and subtitle generation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Transcription Provider</Label>
            <Select
              value={getVal(edits, 'transcription_provider', 'none')}
              onValueChange={(v) => setField('transcription_provider', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Disabled</SelectItem>
                <SelectItem value="whisper">Whisper (Local)</SelectItem>
                <SelectItem value="openai">OpenAI API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Default Subtitle Language</Label>
            <Select
              value={getVal(edits, 'transcription_default_lang', 'en')}
              onValueChange={(v) => setField('transcription_default_lang', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="id">Indonesian</SelectItem>
                <SelectItem value="ja">Japanese</SelectItem>
                <SelectItem value="zh">Chinese</SelectItem>
                <SelectItem value="ko">Korean</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2">
          <Switch
            checked={getBool(edits, 'auto_transcribe')}
            onCheckedChange={(v) => setBoolField('auto_transcribe', v)}
          />
          <Label>Auto-transcribe on Upload</Label>
        </div>
      </CardContent>
    </Card>
  );
}
