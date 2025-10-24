import React, { useState, useRef, useMemo } from 'react';
import { marked } from 'marked';

// --- Environment Setup (API constants) ---
const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// --- Initial Content ---
const initialMarkdown = `# Markdown Syntax Guide

## Headers

# H1 Header
## H2 Header
### H3 Header
#### H4 Header
##### H5 Header
###### H6 Header

## Text Formatting

**Bold text** or __bold text__
*Italic text* or _italic text_
***Bold and italic*** or ___bold and italic___
~~Strikethrough text~~
\`Inline code\`

## Lists

### Unordered Lists
- Item 1
- Item 2
  - Nested item 2.1
  - Nested item 2.2
- Item 3

### Ordered Lists
1. First item
2. Second item
   1. Nested item 2.1
   2. Nested item 2.2
3. Third item

### Task Lists
- [x] Completed task
- [ ] Incomplete task
- [ ] Another task

## Links and Images

[Link text](https://example.com)
[Link with title](https://example.com "Title")

![Alt text](https://via.placeholder.com/150)
![Image with title](https://via.placeholder.com/200 "Image Title")

## Code Blocks

### Inline Code
Use \`console.log()\` to print output.

### Code Blocks
\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet("World"));
\`\`\`

\`\`\`python
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

print(fibonacci(10))
\`\`\`

## Blockquotes

> This is a blockquote.
> It can span multiple lines.
>
> > Nested blockquotes are also possible.

## Tables

| Name | Age | City |
|------|-----|------|
| John | 25 | NYC |
| Jane | 30 | LA |
| Bob | 35 | Chicago |

| Left Aligned | Center Aligned | Right Aligned |
|:-------------|:--------------:|--------------:|
| Left | Center | Right |
| Text | Text | Text |

## Horizontal Rules

---

***

___

## Line Breaks

This is line one  
This is line two (two spaces at end of previous line)

This is a new paragraph.

## Escape Characters

\\*Not italic\\*
\\**Not bold\\**
\\[Not a link\\]

## HTML Elements

<kbd>Ctrl</kbd> + <kbd>C</kbd>

<mark>Highlighted text</mark>

<sub>Subscript</sub> and <sup>Superscript</sup>

## Footnotes

Here's a sentence with a footnote[^1].

[^1]: This is the footnote content.

## Definition Lists

Term 1
: Definition 1

Term 2
: Definition 2a
: Definition 2b

---

*This guide covers most common Markdown syntax. Try editing and see the live preview!*`;

const App = () => {
    // --- State Management ---
    const [markdownText, setMarkdownText] = useState(initialMarkdown);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Ready.');
    const [selectedTone, setSelectedTone] = useState('professional');
    const [htmlPreview, setHtmlPreview] = useState('');
    const [showingSummary, setShowingSummary] = useState(false);
    const [isDark, setIsDark] = useState(true);
    const editorRef = useRef(null);

    // --- Core Logic: Markdown Parsing ---
    const parsedHtml = useMemo(() => {
        try {
            // Configure marked.js for clean, safe output
            marked.setOptions({
                gfm: true,
                breaks: true
            });
            return marked.parse(markdownText);
        } catch (e) {
            return `<p class="text-red-500 font-bold">Error parsing markdown: ${e.message}</p>`;
        }
    }, [markdownText]);

    // Use custom HTML preview if set, otherwise use parsed markdown
    const displayHtml = htmlPreview || parsedHtml;

    // --- Utility Functions ---
    const showStatus = (message, isError = false) => {
        setStatusMessage(message);
        // Reset status after 5 seconds unless it's an error
        if (!isError) {
            setTimeout(() => setStatusMessage('Ready.'), 5000);
        }
    };

    const toggleLoading = (isLoading) => {
        setLoading(isLoading);
        if (isLoading) {
            showStatus("Thinking...", false);
        } else {
            showStatus("Done.", false);
        }
    };

    const getSelectedText = () => {
        const editorElement = editorRef.current;
        if (!editorElement) return { selectedText: '', start: 0, end: 0 };

        const start = editorElement.selectionStart;
        const end = editorElement.selectionEnd;
        const selectedText = editorElement.value.substring(start, end).trim();
        return { selectedText, start, end, editorElement };
    };

    /**
     * Generic function to call the Gemini API with exponential backoff.
     */
    const callGeminiApi = async (userQuery, systemPrompt, retryCount = 0) => {
        const maxRetries = 3;
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

            if (text) {
                return text;
            } else {
                console.error("Gemini API Error: No text content in response.", result);
                throw new Error("Failed to generate content. The model returned an empty response.");
            }
        } catch (error) {
            if (retryCount < maxRetries) {
                const delay = Math.pow(2, retryCount) * 1000;
                console.warn(`API call failed. Retrying in ${delay / 1000}s... (Attempt ${retryCount + 1})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return callGeminiApi(userQuery, systemPrompt, retryCount + 1);
            } else {
                console.error("Gemini API failed after multiple retries:", error);
                throw new Error(`AI generation failed after ${maxRetries} attempts.`);
            }
        }
    };

    // --- LLM Feature Implementations ---
    const changeTone = async () => {
        const { selectedText, start, end, editorElement } = getSelectedText();

        if (selectedText.length < 5) {
            showStatus("Please select text (at least 5 characters) to change the tone.", true);
            return;
        }

        toggleLoading(true);

        try {
            const systemPrompt = `You are a style transformer. Rewrite the user's selected text in a **${selectedTone}** tone. Maintain the original meaning. Output only the rewritten text.`;
            const userQuery = `Rewrite the following text in a ${selectedTone} tone:\n\n${selectedText}`;

            const tonedText = await callGeminiApi(userQuery, systemPrompt);

            // Replace the selected text with the new output
            const newValue = editorElement.value.substring(0, start) + tonedText + editorElement.value.substring(end);
            setMarkdownText(newValue);
            showStatus(`Tone changed to '${selectedTone}' successfully.`, false);

        } catch (error) {
            showStatus(`Error: ${error.message}`, true);
            console.error(error);
        } finally {
            toggleLoading(false);
        }
    };

    const refineSelection = async () => {
        const { selectedText, start, end, editorElement } = getSelectedText();

        if (selectedText.length < 5) {
            showStatus("Please select a larger block of text (at least 5 characters) to refine.", true);
            return;
        }

        toggleLoading(true);

        try {
            const systemPrompt = "You are a professional editor. Rephrase and refine the user's selected text to be clearer, more engaging, and more professional. Maintain the original meaning. Output only the refined text.";
            const userQuery = `Refine the following text:\n\n${selectedText}`;

            const refinedText = await callGeminiApi(userQuery, systemPrompt);

            // Replace the selected text with the refined output
            const newValue = editorElement.value.substring(0, start) + refinedText + editorElement.value.substring(end);
            setMarkdownText(newValue);
            showStatus("Selection refined successfully.", false);

        } catch (error) {
            showStatus(`Error: ${error.message}`, true);
            console.error(error);
        } finally {
            toggleLoading(false);
        }
    };

    const fixGrammarTone = async () => {
        const markdown = markdownText.trim();

        if (!markdown) {
            showStatus("Editor is empty. Nothing to fix.", true);
            return;
        }

        toggleLoading(true);

        try {
            const systemPrompt = "You are a rigorous proofreading and style checker. Review the user's provided document. Fix all grammatical errors, spelling mistakes, and improve sentence flow and professional tone. Preserve the markdown structure (headings, lists, blockquotes) exactly. Output only the final corrected markdown text.";
            const userQuery = `Fix grammar and flow in the following document:\n\n${markdown}`;

            const correctedText = await callGeminiApi(userQuery, systemPrompt);

            // Replace entire content
            setMarkdownText(correctedText);
            showStatus("Grammar and flow corrected successfully.", false);

        } catch (error) {
            showStatus(`Error: ${error.message}`, true);
            console.error(error);
        } finally {
            toggleLoading(false);
        }
    };

    const summarizeContent = async () => {
        const markdown = markdownText.trim();
        if (!markdown) {
            showStatus("Editor is empty. Nothing to summarize.", true);
            return;
        }

        toggleLoading(true);

        try {
            const systemPrompt = "You are a professional summarization tool. Provide a concise, professional summary of the user's provided document in a paragraph or two. Output only the summary text, do not add prefixes or titles.";
            const userQuery = `Summarize the following document:\n\n${markdown}`;

            const summaryText = await callGeminiApi(userQuery, systemPrompt);

            const summaryHtml = marked.parse(`## Document Summary ✨\n\n${summaryText}`);
            setHtmlPreview(summaryHtml);
            setShowingSummary(true);
            showStatus("Summary generated and displayed in Preview. Click × to close.", false);

        } catch (error) {
            showStatus(`Error: ${error.message}`, true);
            console.error(error);
        } finally {
            toggleLoading(false);
        }
    };

    const closeSummary = () => {
        setHtmlPreview('');
        setShowingSummary(false);
    };

    const toggleTheme = () => {
        setIsDark(!isDark);
        document.body.classList.toggle('dark');
    };

    // Reset preview when markdown changes
    React.useEffect(() => {
        if (htmlPreview) {
            setHtmlPreview('');
        }
    }, [markdownText]);
    
    // --- JSX Render ---
    return (
        <div className={`min-h-screen font-sans ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <div className="max-w-full">
                {/* Compact Toolbar */}
                <div className={`p-1 border-b ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-gray-100 border-gray-300'}`}>
                    <div className="flex flex-wrap gap-1 items-center text-xs">
                        
                        <button onClick={changeTone} disabled={loading} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 border rounded text-xs disabled:opacity-50">
                            🎭 Change Tone
                        </button>
                        <select value={selectedTone} onChange={(e) => setSelectedTone(e.target.value)} disabled={loading} className="px-1 py-1 text-xs border rounded disabled:opacity-50">
                            <option value="professional">Professional</option>
                            <option value="casual">Casual</option>
                            <option value="academic">Academic</option>
                            <option value="persuasive">Persuasive</option>
                            <option value="witty">Witty</option>
                        </select>

                        <button onClick={refineSelection} disabled={loading} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 border rounded text-xs disabled:opacity-50">
                            ✏️ Refine
                        </button>
                        <button onClick={fixGrammarTone} disabled={loading} className="px-2 py-1 bg-gray-200 hover:bg-gray-300 border rounded text-xs disabled:opacity-50">
                            🧐 Fix Grammar
                        </button>
                        <button onClick={summarizeContent} disabled={loading} className={`px-2 py-1 border rounded text-xs disabled:opacity-50 ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300'}`}>
                            ✨ Summarize
                        </button>
                        <button onClick={toggleTheme} className={`px-2 py-1 border rounded text-xs ${isDark ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300'}`}>
                            {isDark ? '☀️' : '🌙'}
                        </button>

                        <div className="flex items-center gap-1 ml-auto">
                            {loading && <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent"></div>}
                            <span className={`text-xs ${statusMessage.includes('Error') ? 'text-red-600' : isDark ? 'text-gray-300' : 'text-gray-600'}`}>{statusMessage}</span>
                        </div>
                    </div>
                </div>

                {/* Main Editor and Preview Container */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-1 h-[calc(100vh-60px)]">

                    {/* 1. Markdown Editor (Input) */}
                    <div className="flex flex-col">
                        <textarea
                            ref={editorRef}
                            value={markdownText}
                            onChange={(e) => setMarkdownText(e.target.value)}
                            className="flex-grow p-5 text-base border-2 border-gray-700 rounded-xl shadow-2xl 
                                     focus:ring-indigo-500 focus:border-indigo-500 transition duration-150 
                                     bg-gray-900 text-gray-200 resize-none font-mono leading-relaxed"
                            placeholder="Type your Markdown here..."
                            spellCheck="false"
                        />
                    </div>

                    {/* 2. HTML Preview (Output) */}
                    <div className="flex flex-col">
                        {showingSummary && (
                            <div className="flex justify-end p-1">
                                <button onClick={closeSummary} className="bg-red-500 text-white rounded w-5 h-5 text-xs hover:bg-red-600" title="Close Summary">×</button>
                            </div>
                        )}
                        <div 
                            id="preview"
                            dangerouslySetInnerHTML={{ __html: displayHtml }}
                            className={`flex-grow p-5 text-base border-2 rounded-xl shadow-2xl overflow-y-auto leading-relaxed prose max-w-none [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_blockquote]:border-l-4 [&_blockquote]:pl-4 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:text-sm ${
                                showingSummary 
                                    ? isDark ? 'bg-indigo-900 border-indigo-500 border-l-4 text-gray-200 prose-invert' : 'bg-indigo-50 border-indigo-400 border-l-4 prose-indigo'
                                    : isDark ? 'bg-gray-800 border-gray-600 text-gray-200 prose-invert [&_blockquote]:border-indigo-400 [&_pre]:bg-gray-900 [&_pre]:text-gray-200' : 'bg-white border-indigo-300 prose-indigo [&_blockquote]:border-indigo-500 [&_pre]:bg-gray-800 [&_pre]:text-gray-200'
                            }`}
                        />
                    </div>
                </div>
            </div>
            
            {/* Fixed Footer */}
            <footer className={`fixed bottom-0 left-0 right-0 text-center py-1 text-xs border-t ${isDark ? 'text-gray-400 border-gray-600 bg-gray-800' : 'text-gray-500 border-gray-300 bg-gray-100'}`}>
                © 2024 AI-Powered Markdown Editor
            </footer>
        </div>
    );
};

export default App;