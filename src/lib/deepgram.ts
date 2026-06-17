import {
  createClient,
  LiveTranscriptionEvents,
  type DeepgramClient,
  type LiveClient,
} from "@deepgram/sdk";
import type { TranscriptChunk } from "@/types";

let _client: DeepgramClient | null = null;

function getClient(): DeepgramClient {
  if (!_client) {
    const key = process.env.DEEPGRAM_API_KEY;
    if (!key) throw new Error("DEEPGRAM_API_KEY is not set");
    _client = createClient(key);
  }
  return _client;
}

export interface DeepgramStreamOptions {
  meetingId: string;
  onChunk: (chunk: TranscriptChunk) => void;
  onError: (err: Error) => void;
  onClose: () => void;
}

export function createLiveStream(options: DeepgramStreamOptions): LiveClient {
  const dg = getClient();

  const connection = dg.listen.live({
    model: "nova-3",
    language: "en-US",
    diarize: true,
    smart_format: true,
    punctuate: true,
    utterance_end_ms: 1000,
    vad_events: true,
    encoding: "opus",
    sample_rate: 48000,
    channels: 1,
    // Pass corporate keywords per Phase 4 tuning — populated from env
    keywords: process.env.DEEPGRAM_KEYWORDS?.split(",").filter(Boolean) ?? [],
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log(`[deepgram] stream open for meeting ${options.meetingId}`);
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const alt = data.channel?.alternatives?.[0];
    if (!alt?.transcript || alt.transcript.trim() === "") return;

    const words = alt.words ?? [];
    const speakerGroups = groupBySpeaker(words);

    for (const group of speakerGroups) {
      options.onChunk({
        speaker: group.speaker,
        text: group.text,
        start: group.start,
      });
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (err) => {
    options.onError(new Error(String(err)));
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    options.onClose();
  });

  return connection;
}

interface WordGroup {
  speaker: number;
  text: string;
  start: number;
}

function groupBySpeaker(words: Array<{ speaker?: number; word: string; start: number }>): WordGroup[] {
  if (words.length === 0) return [];

  const groups: WordGroup[] = [];
  let current: WordGroup = {
    speaker: words[0].speaker ?? 0,
    text: words[0].word,
    start: words[0].start,
  };

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const spk = w.speaker ?? 0;
    if (spk === current.speaker) {
      current.text += ` ${w.word}`;
    } else {
      groups.push(current);
      current = { speaker: spk, text: w.word, start: w.start };
    }
  }
  groups.push(current);
  return groups;
}

export async function transcribeFile(audioBuffer: Buffer): Promise<TranscriptChunk[]> {
  const dg = getClient();

  const { result, error } = await dg.listen.prerecorded.transcribeFile(audioBuffer, {
    model: "nova-3",
    language: "en-US",
    diarize: true,
    smart_format: true,
    punctuate: true,
    keywords: process.env.DEEPGRAM_KEYWORDS?.split(",").filter(Boolean) ?? [],
  });

  if (error) throw new Error(`Deepgram pre-recorded error: ${error.message}`);

  const words = result?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];
  const groups = groupBySpeaker(words);
  return groups.map((g) => ({ speaker: g.speaker, text: g.text, start: g.start }));
}
