# Gemini CLI OpenAI Proxy

A lightweight Node.js server that acts as a bridge between OpenAI-compatible clients and the Google Gemini CLI. 

This project allows you to use the **Gemini CLI** programmatically with tools, libraries, and UIs designed for the OpenAI API (like generic chat interfaces, VS Code extensions, or AutoGPT-style scripts) by mimicking the `v1/chat/completions` endpoint.

## Features

- **OpenAI Compatibility**: Implements `/v1/chat/completions` and `/v1/models`.
- **Streaming Support**: Converts Gemini's `stream-json` output into OpenAI Server-Sent Events (SSE) for real-time token streaming.
- **Context Management**: Automatically converts OpenAI conversation history (Messages API) into a structured prompt format suitable for the stateless Gemini CLI.
- **Tool Grounding**: Includes system prompt injection to prevent tool hallucinations (e.g., stopping the model from trying to run shell commands when only file search is available).
- **Authentication**: Simple Bearer token authentication.

## Prerequisites

1.  **Node.js**: v14+ installed.
2.  **Gemini CLI**: You must have the Gemini CLI installed and authenticated on the host machine.
    * Ensure running `gemini --prompt "Hello"` works in your terminal.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/yourusername/gemini-cli-openai-proxy.git](https://github.com/yourusername/gemini-cli-openai-proxy.git)
    cd gemini-cli-openai-proxy
    ```

2.  **Install dependencies:**
    ```bash
    npm install express body-parser cors
    ```

3.  **Start the server:**
    ```bash
    node server.js
    ```
    *By default, the server runs on port 3000.*

## Configuration

You can configure the server using environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | The port the server listens on. | `3000` |
| `OPENAI_API_KEY` | The Bearer token required by clients. | `sk-dummy-key` |

Example:
```bash
export OPENAI_API_KEY="my-secret-key"
export PORT=8080
node server.js
