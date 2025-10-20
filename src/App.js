import React, { useState, useRef, useMemo } from 'react';
import { marked } from 'marked';

// --- Environment Setup (API constants) ---
const apiKey = "";
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// --- Initial Content ---
const initialMarkdown = `# The Art of Subdomain Hosting

This document explores the fascinating world of hosting applications on subdomains. Subdomains allow developers to segment different parts of a project, creating clean separation for specific tools or features without needing entirely new domain names. For instance, a main site might be at \`example.com\`, while an internal tool lives at \`app.example.com\` and a blog at \`blog.example.com\`.

## Technical Considerations
Setting up a subdomain involves DNS configuration, specifically creating an A record or CNAME record that points the subdomain to a new server or a specific directory on an existing server. This is crucial for maintaining performance and security isolation. The performance benefits often come from dedicated server resources, especially if the application at the subdomain is resource-intensive.

> "Modularity is the key to scalable software." - P. J. Plauger`;

const App = () => {
    // --- State Management ---
    const [markdownText, setMarkdownText] = useState(initialMarkdown);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('Ready.');
    const [selectedTone, setSelectedTone] = useState('professional');
    const [htmlPreview, setHtmlPreview] = useState('');
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
            // Temporarily replace the preview with the summary in a highlighted box
            setHtmlPreview(
                `<div class="p-6 bg-indigo-50 border-l-4 border-indigo-400 rounded-lg shadow-inner">
                    ${summaryHtml}
                </div>`
            );
            showStatus("Summary generated and displayed in Preview. (Type again to restore original preview)", false);

        } catch (error) {
            showStatus(`Error: ${error.message}`, true);
            console.error(error);
        } finally {
            toggleLoading(false);
        }
    };

    const continueWriting = async () => {
        const markdown = markdownText.trim();

        if (!markdown) {
            showStatus("Editor is empty. Start writing first!", true);
            return;
        }

        toggleLoading(true);

        try {
            const systemPrompt = "You are a creative writing assistant. Continue the user's text naturally and seamlessly for about 3-5 sentences. Maintain the existing tone and style. Output only the generated continuation text. Preserve markdown formatting if used in the continuation.";
            const userQuery = `Continue the following text:\n\n${markdown}`;

            const continuation = await callGeminiApi(userQuery, systemPrompt);

            // Append the continuation to the editor
            setMarkdownText(current => current + '\n\n' + continuation);
            showStatus("Writing continued successfully.", false);

        } catch (error) {
            showStatus(`Error: ${error.message}`, true);
            console.error(error);
        } finally {
            toggleLoading(false);
        }
    };

    // Reset preview when markdown changes
    React.useEffect(() => {
        if (htmlPreview) {
            setHtmlPreview('');
        }
    }, [markdownText]);
    
    // --- JSX Render ---
    return (
        <div className="bg-gray-50 min-h-screen p-4 md:p-8 font-sans">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <header className="mb-8 pb-4 border-b-2 border-indigo-300">
                    <h1 className="text-4xl font-extrabold text-indigo-700">AI-Powered Writing Studio</h1>
                    <p className="text-gray-500 mt-1">Refine, extend, and correct your content using advanced AI tools.</p>
                </header>

                {/* AI Controls and Status */}
                <div className="mb-8 p-5 bg-white rounded-2xl shadow-xl border border-indigo-100">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Writing Assistant Tools</h2>
                    <div className="flex flex-wrap gap-4 items-center">
                        
                        {/* Change Tone Group */}
                        <div className="flex items-center gap-3 bg-purple-50 p-3 rounded-full shadow-inner">
                            <button onClick={changeTone} disabled={loading}
                                    className="px-5 py-2 bg-purple-600 text-white font-semibold rounded-full shadow-md hover:bg-purple-700 transition duration-150 disabled:opacity-50 disabled:shadow-none">
                                Change Tone 🎭
                            </button>
                            <select 
                                id="toneSelector" 
                                value={selectedTone} 
                                onChange={(e) => setSelectedTone(e.target.value)} 
                                disabled={loading}
                                className="bg-purple-100 text-purple-800 font-medium py-2 px-4 rounded-full border border-purple-300 focus:ring-purple-500 focus:border-purple-500 text-sm appearance-none cursor-pointer disabled:opacity-50"
                            >
                                <option value="professional">Professional</option>
                                <option value="casual">Casual/Friendly</option>
                                <option value="academic">Academic</option>
                                <option value="persuasive">Persuasive</option>
                                <option value="witty">Witty/Humorous</option>
                            </select>
                        </div>

                        {/* Quick Action Buttons */}
                        <button onClick={refineSelection} disabled={loading}
                                className="px-5 py-2 bg-yellow-500 text-white font-semibold rounded-full shadow-md hover:bg-yellow-600 transition duration-150 disabled:opacity-50 disabled:shadow-none">
                            Refine Selection ✏️
                        </button>
                        <button onClick={fixGrammarTone} disabled={loading}
                                className="px-5 py-2 bg-blue-500 text-white font-semibold rounded-full shadow-md hover:bg-blue-600 transition duration-150 disabled:opacity-50 disabled:shadow-none">
                            Fix Grammar & Flow 🧐
                        </button>
                        <button onClick={summarizeContent} disabled={loading}
                                className="px-5 py-2 bg-pink-500 text-white font-semibold rounded-full shadow-md hover:bg-pink-600 transition duration-150 disabled:opacity-50 disabled:shadow-none">
                            Summarize Content ✨
                        </button>
                        <button onClick={continueWriting} disabled={loading}
                                className="px-5 py-2 bg-green-500 text-white font-semibold rounded-full shadow-md hover:bg-green-600 transition duration-150 disabled:opacity-50 disabled:shadow-none">
                            Continue Writing ✍️
                        </button>
                        
                        {/* Status/Loading */}
                        <div className="flex items-center space-x-3 ml-auto min-w-[150px] mt-4 md:mt-0">
                            {loading && (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                            )}
                            <div className={`text-sm font-medium ${statusMessage.includes('Error') ? 'text-red-600' : 'text-gray-600'}`}>
                                {statusMessage}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Editor and Preview Container */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[70vh]">

                    {/* 1. Markdown Editor (Input) */}
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold mb-3 text-gray-700">Markdown Source</h2>
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
                        <h2 className="text-xl font-bold mb-3 text-gray-700">Live Preview</h2>
                        <div 
                            id="preview"
                            dangerouslySetInnerHTML={{ __html: displayHtml }}
                            className="flex-grow p-5 text-base border-2 border-indigo-300 rounded-xl shadow-2xl 
                                     bg-white overflow-y-auto leading-relaxed
                                     prose prose-indigo max-w-none 
                                     [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 
                                     [&_blockquote]:border-l-4 [&_blockquote]:border-indigo-500 [&_blockquote]:pl-4 
                                     [&_pre]:bg-gray-800 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:text-sm [&_pre]:text-gray-200"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;