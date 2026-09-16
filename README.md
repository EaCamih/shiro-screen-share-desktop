<div align="center">

<img src="icon.ico" width="96" height="96" alt="Shiro Screen Share">

# Shiro Screen Share

**Desktop app for ultra-low-latency screen sharing via LiveKit + Discord Activities**

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron)](https://www.electronjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-00AE5C?logo=webrtc)](https://livekit.io/)
[![Platform](https://img.shields.io/badge/Platform-Windows-0078D6?logo=windows)](https://www.microsoft.com/windows)

</div>

---

## ✨ Overview

**Shiro Screen Share** is a custom Electron desktop application that captures your screen (or individual windows) and streams it in real-time to a **LiveKit** WebRTC room — designed specifically to power **Discord Activity** integrations.

It offers:
- 🎯 **Per-process audio isolation** — capture only the audio of a specific application (e.g. a game), not your entire system
- 📡 **Real-time WebRTC streaming** via LiveKit with dynamic quality adjustment
- ⚡ **Zero-desync A/V pipeline** — 0ms artificial buffer between video and audio
- 🎛️ **In-app settings panel** — resolution, FPS, bitrate and priority adjustable while live
- 🎨 **Premium UI** with dark/light themes, 2×2 source grid, floating overlay controls
- 🔒 **Deep-link activation** — stream only starts from a trusted Discord Activity deep link

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                    Electron Main Process               │
│                                                        │
│  ┌──────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ AudioEngine  │  │ IpcHandlers │  │ WindowScanner │  │
│  │ (loopback-   │  │ (IPC bridge │  │ (enumerates   │  │
│  │  capture)    │  │  main↔rend) │  │  windows/app) │  │
│  └──────┬───────┘  └──────┬──────┘  └───────┬───────┘  │
│         │ PCM chunks      │ IPC             │ sources  │
└─────────┼─────────────────┼─────────────────┼──────────┘
          │                 │                 │
┌─────────▼─────────────────▼─────────────────▼──────────┐
│                  Electron Renderer (UI)                │
│                                                        │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │ AudioPipeline│  │ LiveKitPublish │  │ SourcePickr│  │
│  │ (WebAudio +  │  │ (WebRTC rooms  │  │ (2×2 grid  │  │
│  │  AnalyserNode│  │  + track pub.) │  │  preview)  │  │
│  └──────────────┘  └────────────────┘  └────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Key Modules

| File | Layer | Responsibility |
|------|-------|---------------|
| `src/main/main.ts` | Main | App lifecycle, Tray, GPU flags, deep-link handling |
| `src/main/audioEngine.ts` | Main | WASAPI loopback capture via `loopback-capture`, PCM streaming |
| `src/main/ipcHandlers.ts` | Main | IPC bridge — exposes audio, window, token APIs to renderer |
| `src/main/windowScanner.ts` | Main | Native window enumeration (Win32 API via `koffi`) |
| `src/main/protocol.ts` | Main | `shiro://` custom URL protocol handler |
| `src/renderer/src/app.ts` | Renderer | Main UI controller, stream lifecycle orchestration |
| `src/renderer/src/audioPipeline.ts` | Renderer | WebAudio pipeline: PCM → AnalyserNode → MediaStreamTrack |
| `src/renderer/src/livekitPublisher.ts` | Renderer | LiveKit SDK integration, track publishing & replacement |
| `src/renderer/src/sourcePicker.ts` | Renderer | Source grid rendering & selection |
| `src/renderer/src/uiComponents.ts` | Renderer | Canvas audio visualizer, window controls, stream status |
| `src/preload/index.ts` | Preload | Context bridge — exposes safe `window.api` surface |

---

## 🚀 Getting Started

### Prerequisites

- **Windows 10/11** (required — audio capture uses WASAPI, a Windows-only API)
- **Node.js 18+** and **npm**
- A running **LiveKit** server (self-hosted or cloud) and a backend that issues LiveKit tokens

### 1. Clone the repository

```bash
git clone https://github.com/your-username/share-desktop.git
cd share-desktop
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env` file at the root of the project:

```env
# URL of your token-issuing backend
BACKEND_URL=https://your-backend.example.com/

# WebSocket URL of your LiveKit server
LIVEKIT_URL=wss://your-livekit.example.com
```

> **Note:** Never commit your `.env` file. It is already listed in `.gitignore`.

### 4. Run in development mode

```bash
npm run dev
```

This will:
1. Clean previous build artifacts
2. Run TypeScript type-checking (`tsc --noEmit`)
3. Bundle all three processes (main, preload, renderer) with `esbuild`
4. Launch Electron pointing at the built output

---

## 📦 Building for Production

> **Important:** Run your terminal as **Administrator** on Windows. The `electron-builder` packaging step needs symlink privileges to correctly bundle code-signing tools.

```bash
# Build and create installer + portable .exe
npm run build
```

Output is placed in `dist/build/`:
- `Shiro Screen Share Setup X.X.X.exe` — NSIS installer with Start Menu & Desktop shortcuts
- `Shiro Screen Share X.X.X.exe` — Standalone portable executable

---

## 🔌 How the Deep Link Works

The application registers the `shiro://` custom URL protocol on Windows.

When a user clicks **"Share Screen"** inside a Discord Activity, the Activity sends a deep link like:

```
shiro://launch?room=my-room&userId=12345&identity=myuser
```

This:
1. Opens (or focuses) the Shiro app
2. Pre-fills the hidden LiveKit room/identity fields
3. Enables the **"Start Broadcast"** button

The button remains **disabled** until a valid deep link is received — preventing accidental or unauthorized streams.

---

## 🎵 Audio Pipeline

Audio is captured at the OS level using **WASAPI loopback** (Windows Audio Session API), which lets us intercept the rendered PCM output of a specific process without installing virtual audio devices.

```
WASAPI Loopback (per-process) 
    → PCM Int16 chunks (48kHz stereo)
    → IPC (Electron main → renderer)
    → AudioContext.createBufferSource()
    → AnalyserNode (FFT 256, frequency visualizer)
    → MediaStreamAudioDestinationNode
    → LiveKit audio track
```

### Audio Modes

| Mode | Description |
|------|-------------|
| **App Only** | Captures only the audio output of the selected process |
| **System Audio** | Captures all system audio output (WASAPI global loopback) |
| **No Audio** | Video-only stream |

The scheduler uses `AudioContext.currentTime` directly with no artificial look-ahead, resulting in near-zero A/V desync.

---

## 🎥 Video Pipeline

Video is captured using Chromium's built-in `desktopCapturer` API (via `navigator.mediaDevices.getUserMedia` with `chromeMediaSource: 'desktop'`).

Quality parameters are applied as `MediaTrackConstraints` at capture time and can be changed **live** without stopping the stream:

| Parameter | Options |
|-----------|---------|
| Resolution | 480p, 720p, 1080p, 1440p, 4K |
| Frame Rate | 30, 60, 120 FPS |
| Bitrate | 2.5, 4.5, 8, 12 Mbps |
| Degradation | Maintain Resolution / Maintain FPS / Balanced |

When quality changes while live, the existing LiveKit track is replaced via `RTCRtpSender.replaceTrack()` without disconnecting.

---

## 🧱 Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| [Electron](https://electronjs.org) | 33 | Desktop runtime |
| [TypeScript](https://www.typescriptlang.org) | 5.3 | Type-safe codebase |
| [esbuild](https://esbuild.github.io) | 0.24 | Ultra-fast bundler |
| [LiveKit Client SDK](https://github.com/livekit/client-sdk-js) | 2.x | WebRTC room & track publishing |
| [loopback-capture](https://www.npmjs.com/package/loopback-capture) | 3.x | Native WASAPI per-process audio capture |
| [koffi](https://koffi.dev) | 3.x | FFI bindings for Win32 window enumeration |
| [Lucide](https://lucide.dev) | 0.469 | Icon library |
| Web Audio API | — | PCM → MediaStream conversion + AnalyserNode |
| CSS (Vanilla) | — | Custom OLED dark / crisp light theme |

---

## 📁 Project Structure

```
share-desktop/
├── src/
│   ├── main/               # Electron Main Process
│   │   ├── main.ts         # Entry point, window, tray, GPU flags
│   │   ├── audioEngine.ts  # WASAPI loopback audio capture
│   │   ├── ipcHandlers.ts  # IPC handler registration
│   │   ├── windowScanner.ts# Win32 window/process enumeration
│   │   └── protocol.ts     # shiro:// deep link protocol
│   ├── preload/
│   │   ├── index.ts        # Context bridge (window.api)
│   │   └── index.d.ts      # Type declarations for window.api
│   ├── renderer/
│   │   ├── index.html      # App shell
│   │   ├── index.css       # Global styles & theme tokens
│   │   └── src/
│   │       ├── app.ts              # Main app controller
│   │       ├── audioPipeline.ts    # WebAudio + AnalyserNode pipeline
│   │       ├── livekitPublisher.ts # LiveKit SDK wrapper
│   │       ├── sourcePicker.ts     # Source grid UI
│   │       └── uiComponents.ts     # Canvas visualizer, controls
│   └── types/
│       ├── audio.ts        # Audio mode types
│       ├── capture.ts      # Source & quality option types
│       └── ipc.ts          # IPC message types
├── electron-builder.yml    # Packaging configuration
├── tsconfig.json           # TypeScript config
├── package.json
├── icon.ico                # App icon
├── .env                    # ⚠️ Local config (not committed)
└── LICENSE
```

---

## 🛡️ Security

- **Context Isolation** is enabled — the renderer has no direct access to Node.js APIs
- **Node Integration** is disabled in the renderer
- All renderer↔main communication goes through a strictly-typed **context bridge** (`window.api`)
- The stream start button is gated behind a valid deep link to prevent unauthorized broadcasts

---

## 🤝 Credits

- **Hito** — Lead development, architecture, and design
- **[EaCamih](https://github.com/EaCamih)** — Invaluable assistance, testing, and feedback throughout development ❤️

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
