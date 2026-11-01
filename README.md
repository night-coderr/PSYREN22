# PSYREN22

Premium AI browser companion for Windows 11 and Brave/Chrome.

## Free setup

1. Open Google AI Studio: https://aistudio.google.com/app/apikey
2. Sign in with Google, create a Gemini API key, and keep it private.
3. Open Brave on Windows, then visit `brave://extensions`.
4. Turn on **Developer mode**.
5. Click **Load unpacked** and select:

   `C:\Users\DELL\Desktop\PSYREN22`

6. Open PSYREN from the extensions toolbar, right-click the PSYREN icon and open **Options**, then save the API key.
7. Open the PSYREN side panel with **Alt+P** or from the extension popup.

## Features

- AI chat with current-page context
- Full webpage summary
- YouTube summary on the video page
- English to conversational Hinglish
- Screenshot capture and AI analysis
- Confirmation-gated click, type, focus, and scroll actions
- Persistent memory (`remember this ...`)
- PSYREN settings and memory management

## Browser Agent safety

Browser actions are never executed automatically. PSYREN displays the exact proposed action and waits for **Allow action**. Close the confirmation box with **Not now** to cancel.

## Free usage

Gemini usage follows Google's personal free-quota terms at the time of use. If the quota is reached, Google may display a limit in the extension. You must create and manage your own API key; no key is included in this folder.

## Why answers may take longer

PSYREN sends page context and the user prompt to Gemini. On large pages, slow responses are usually caused by a large payload, network latency, model quota, or the Gemini service. PSYREN limits page context, uses Flash for lower latency, and stops requests after 45 seconds with an error instead of remaining stuck.

Translation intentionally uses only the text selected on the page. Select English text first, then click **Translate**; addresses, footers, navigation, and Terms text are not sent.

## Build-free

The extension is plain HTML, CSS, and JavaScript. No npm install or build step is required.
