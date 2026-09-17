import { Schema, MapSchema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('string') sessionId = '';
  @type('string') userId = '';
  @type('string') displayName = '';
  @type('string') vehicleId = '';
  @type('string') colorwayId = '';
  @type('boolean') isBot = false;
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') rotY = 0;
  @type('number') speedKmh = 0;
  @type('number') lap = 0;
  @type('number') checkpointIndex = 0;
  @type('number') position = 1;
  @type('boolean') finished = false;
  @type('number') finishTimeMs = 0;
  @type('boolean') connected = true;
  @type('boolean') flaggedForReview = false;
}

export class RaceRoomState extends Schema {
  @type('string') trackId = '';
  @type('string') mode = 'quick';
  @type('number') totalLaps = 3;
  @type('string') phase: 'lobby' | 'countdown' | 'racing' | 'finished' = 'lobby';
  @type('number') countdownValue = 0;
  @type('number') serverTimeMs = 0;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
