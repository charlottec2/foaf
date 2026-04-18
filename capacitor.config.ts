// Capacitor configuration — wrap this PWA into native iOS/Android shells.
// To build native: npx cap add ios && npx cap add android, then npx cap sync.
import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.7d125dae5d3e48f0b2453d360990387f",
  appName: "Friend of a Friend",
  webDir: "dist",
  // Hot-reload from the Lovable sandbox while developing on a device:
  server: {
    url: "https://7d125dae-5d3e-48f0-b245-3d360990387f.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
};

export default config;
