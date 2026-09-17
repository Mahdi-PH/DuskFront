import type { GraphicsQuality } from '@velocity-island/shared';

export interface GraphicsProfile {
  resolutionScale: number;
  shadowMapSize: number;
  shadowsEnabled: boolean;
  particleMultiplier: number;
  postProcessingEnabled: boolean;
  bloomEnabled: boolean;
  viewDistance: number;
  antialias: boolean;
  reflectionsEnabled: boolean;
}

export const GRAPHICS_PROFILES: Record<GraphicsQuality, GraphicsProfile> = {
  low: {
    resolutionScale: 0.75,
    shadowMapSize: 0,
    shadowsEnabled: false,
    particleMultiplier: 0.3,
    postProcessingEnabled: false,
    bloomEnabled: false,
    viewDistance: 350,
    antialias: false,
    reflectionsEnabled: false,
  },
  medium: {
    resolutionScale: 1.0,
    shadowMapSize: 1024,
    shadowsEnabled: true,
    particleMultiplier: 0.6,
    postProcessingEnabled: false,
    bloomEnabled: false,
    viewDistance: 550,
    antialias: false,
    reflectionsEnabled: false,
  },
  high: {
    resolutionScale: 1.0,
    shadowMapSize: 2048,
    shadowsEnabled: true,
    particleMultiplier: 1.0,
    postProcessingEnabled: true,
    bloomEnabled: true,
    viewDistance: 800,
    antialias: true,
    reflectionsEnabled: true,
  },
  ultra: {
    resolutionScale: Math.min(window.devicePixelRatio || 1, 2),
    shadowMapSize: 4096,
    shadowsEnabled: true,
    particleMultiplier: 1.4,
    postProcessingEnabled: true,
    bloomEnabled: true,
    viewDistance: 1200,
    antialias: true,
    reflectionsEnabled: true,
  },
};

export function detectDefaultQuality(): GraphicsQuality {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isMobile) return cores >= 6 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : 'medium';
}
