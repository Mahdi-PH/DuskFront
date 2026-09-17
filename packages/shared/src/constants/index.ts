export const GAME_NAME = 'VELOCITY ISLAND';
export const GAME_NAME_AR = 'جزيرة السرعة';
export const VISUAL_IDENTITY = 'TROPICAL FUTURE ARCADE';

export const PALETTE = {
  oceanBlue: '#1e6fb8',
  turquoise: '#2fd9c9',
  sunsetOrange: '#ff7a3d',
  coral: '#ff5c6c',
  tropicalGreen: '#2fb872',
  deepNavy: '#0c1f3d',
  warmWhite: '#faf6ee',
} as const;

export const CURRENCY_NAME = 'SPEED COINS';
export const CURRENCY_NAME_AR = 'عملات السرعة';

export const SUPPORTED_LOCALES = ['ar', 'en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = 'ar';
export const RTL_LOCALES: SupportedLocale[] = ['ar'];

export const PHYSICS_FIXED_TIMESTEP_SEC = 1 / 60;
export const SERVER_TICK_RATE_HZ = 24;

export const GRAPHICS_QUALITY_LEVELS = ['low', 'medium', 'high', 'ultra'] as const;
export type GraphicsQuality = (typeof GRAPHICS_QUALITY_LEVELS)[number];

export const AI_DIFFICULTIES = ['easy', 'normal', 'hard', 'expert'] as const;
