# AI-Powered Markdown Editor

A React-based markdown editor with AI writing assistance tools powered by Google's Gemini API.

## Features

- **Live Markdown Preview**: Real-time rendering of markdown content
- **AI Writing Tools**:
  - Change tone (professional, casual, academic, persuasive, witty)
  - Refine selected text
  - Fix grammar and flow
  - Summarize content
  - Continue writing assistance
- **Modern UI**: Built with Tailwind CSS for a clean, responsive design

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure API Key**:
   - Copy `.env.example` to `.env`
   - Replace `your_api_key_here` with your Google Gemini API key
   - Get your API key from: https://makersuite.google.com/app/apikey

3. **Start the development server**:
   ```bash
   npm start
   ```

4. **Open your browser** to `http://localhost:3000`

## Usage

1. **Write Markdown**: Type your content in the left editor panel
2. **Live Preview**: See the rendered output in the right panel
3. **AI Tools**: 
   - Select text and use "Refine Selection" or "Change Tone"
   - Use "Fix Grammar & Flow" for the entire document
   - Generate summaries or continue writing with AI assistance

## Project Structure

```
markdown-editor/
├── public/
│   └── index.html          # HTML template
├── src/
│   ├── App.js             # Main React component
│   └── index.js           # React entry point
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## Technologies Used

- **React 18**: Frontend framework
- **Marked.js**: Markdown parsing
- **Tailwind CSS**: Styling (via CDN)
- **Google Gemini API**: AI writing assistance

## Available Scripts

- `npm start`: Run development server
- `npm build`: Build for production
- `npm test`: Run tests
- `npm eject`: Eject from Create React App (not recommended)