export interface TrackShortcut {
  id: string;
  timeSaveSec: number;
  riskPenalty: string;
}

export interface TrackDynamicEvent {
  id: string;
  description: string;
}

export interface TrackDefinition {
  id: string;
  name: string;
  nameAr: string;
  environment: string;
  weather: string;
  defaultLaps: number;
  lengthMeters: number;
  widthMeters: number;
  checkpointCount: number;
  shortcut: TrackShortcut;
  hazards: string[];
  dynamicEvent: TrackDynamicEvent;
  ambientColor: string;
}
