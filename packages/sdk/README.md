# @lumaway/sdk

In-app AI guidance, walkthroughs and observer mode for web applications.

The Lumaway SDK embeds a small runtime in your app that talks to your Lumaway
backend to deliver contextual walkthroughs, an AI assistant, and an observer
mode that records user sessions for later review.

## Install

```bash
npm install @lumaway/sdk
# or
pnpm add @lumaway/sdk
# or
yarn add @lumaway/sdk
```

React projects get the provider out of the box (React 18 or 19). Non-React
apps can use the vanilla `LumaSDK` class directly.

## Quick start — React

```tsx
import { LumaProvider, useLuma } from "@lumaway/sdk";

function App() {
    return (
        <LumaProvider
            config={{
                apiKey: process.env.NEXT_PUBLIC_LUMAWAY_API_KEY!,
                apiUrl: "https://api.lumaway.ai",
            }}
            userContext={{
                userId: "user-123",
                email: "user@example.com",
            }}
        >
            <YourApp />
        </LumaProvider>
    );
}

function YourApp() {
    const { sdk, currentPlan } = useLuma();
    // ...
}
```

## Quick start — Vanilla

```ts
import { LumaSDK } from "@lumaway/sdk";

const sdk = new LumaSDK(
    {
        apiKey: "your-api-key",
        apiUrl: "https://api.lumaway.ai",
    },
    {
        userId: "user-123",
        email: "user@example.com",
    }
);

await sdk.init();
```

## Configuration

| Option          | Type                                              | Notes                                     |
| --------------- | ------------------------------------------------- | ----------------------------------------- |
| `apiKey`        | `string`                                          | Required. Get it from your Lumaway CMS.   |
| `apiUrl`        | `string`                                          | Required. Your Lumaway backend URL.       |
| `locale`        | `string`                                          | Optional. `en`, `es`, etc.                |
| `chatTransport` | `"socket-only" \| "socket-first" \| "rest-only"`  | Defaults to `socket-only`.                |
| `debug`         | `boolean`                                         | Verbose logs for the AI agent flow.       |
| `audio`         | `{ enabled?: boolean; volume?: number }`          | Audio cues. Volume is `0..1`.             |
| `cache`         | `{ enabled?: boolean; ...staleTimeMs?: number }`  | Controls the built-in REST cache.         |

## Peer dependencies

`react` and `react-dom` are optional peer dependencies. The SDK works without
React (the `LumaProvider` / `useLuma` exports just won't be used).

## License

MIT © Blureffect / Lumaway
