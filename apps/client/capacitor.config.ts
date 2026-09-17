import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'island.velocity.game',
  appName: 'Velocity Island',
  webDir: 'dist',
  android: {
    // The web bundle is fully self-contained (Rapier's WASM is inlined as
    // base64 by @dimforge/rapier3d-compat), so no extra asset/MIME wiring
    // is needed for the WebView to load and run the game offline.
    allowMixedContent: false,
  },
};

export default config;
