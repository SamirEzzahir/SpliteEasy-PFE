// lib/config.ts — runtime configuration constants.
//
// React Native has no process.env at runtime the way Next.js does, so the
// backend base URL is a plain constant here.
//
//   • Android emulator:        http://10.0.2.2:8800
//   • iOS simulator:           http://127.0.0.1:8800
//   • Expo Go on real device:  http://<your-LAN-IP>:8800  (must be reachable from the phone)
//
// Change BASE_URL to whatever host the FastAPI backend is reachable at from the
// device running the app.
export const BASE_URL = "http://192.168.1.100:8800";

// WebSocket base — same host, ws:// scheme.
export const WS_URL = BASE_URL.replace(/^http/, "ws");

export const TOKEN_KEY = "spliteasy.token";
export const THEME_KEY = "spliteasy.theme";
