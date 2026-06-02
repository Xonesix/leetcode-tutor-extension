// Cross-browser compatibility shim with extra robustness
const browserAPI = (function() {
    if (typeof browser !== 'undefined' && browser.runtime) {
        return browser;
    }
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome;
    }
    // Fallback to whichever is defined, or an empty object to prevent immediate crash on namespace access
    return (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : {});
})();

console.log("[Background] Initializing with API:", (typeof browser !== 'undefined' && browser.runtime) ? "browser" : "chrome fallback");

if (!browserAPI.runtime) {
    console.error("[Background] Fatal: browserAPI.runtime is undefined. Environment:", {
        hasBrowser: typeof browser !== 'undefined',
        hasChrome: typeof chrome !== 'undefined',
        browserHasRuntime: typeof browser !== 'undefined' && !!browser.runtime,
        chromeHasRuntime: typeof chrome !== 'undefined' && !!chrome.runtime
    });
} else {
    // check for msg from popup
    browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log("[Background] Received message:", request.message);
    if (request.message === "CALL_AI") {
        console.log("[Background] Handling CALL_AI request...");
        // call the AI funct then return true for the async response
        handleAICall(request.scrapedData, request.mode, request.userQuestion)
            .then(response => {
                console.log("[Background] AI call successful, sending response...");
                sendResponse(response);
            })
            .catch(error => {
                console.error("[Background] AI call failed:", error);
                sendResponse({ error: "An error occurred while calling the AI: " + error.message });
            });
        return true;
    }
});
}

async function handleAICall(scrapedData, mode, userQuestion) {
    try {
        // grab the API key from storage
        const storageData = await browserAPI.storage.sync.get(['activeProvider', 'geminiKey', 'claudeKey', 'openaiKey']);
        const provider = storageData.activeProvider;

        // set problem context for the AI based on the scraped data and mode
        const problemContext = `
            Problem: ${scrapedData.title} (${scrapedData.difficulty})
            Description: ${scrapedData.description}
            User Code: ${scrapedData.code}
        `;

        // set system prompt based on mode + build the user message
        let systemPrompt = "";
        let userMessage = problemContext;

        if (userQuestion) {
            userMessage = `Problem the user is working on:\n${problemContext}\n\nUser's request: "${userQuestion}"`;
        }

        if (mode === "tutor") {
            systemPrompt = "You are an expert coding tutor. Give exactly one hint per question, and only provide the next step to solve the problem. Do not give the full solution. If the user asks for another hint, provide the next step. Be encouraging and supportive.";
        }
        else if (mode === "interview") {
            systemPrompt = "You are a strict technical interviewer. Review the user's code and provide feedback on correctness, efficiency, and style. Be critical but constructive. Allow the user to ask follow-up questions.";
        }
        else if (mode === "solution") {
            systemPrompt = "You are a coding solution explainer. Provide a clear and concise explanation of the optimal solution for the given problem. Include time and space complexity analysis.";
        }
        else if (mode === "ask") {
            // Voice question: response will be read aloud, so keep it concise and plain-text friendly
            systemPrompt = "You are a helpful coding coach answering a spoken question. Your reply will be read aloud, so be concise (aim for 2-5 sentences), use plain prose without code blocks or markdown formatting, and answer directly. Do not give away the full solution unless the user explicitly asks for it.";
        }

        // call the appropriate AI provider function and if key is missing, return an error message
        if (provider === "gemini") {
            if (!storageData.geminiKey) {
                return { error: "API key for Gemini not found. Please set it in the extension options." };
            }
            return await callGemini(storageData.geminiKey, systemPrompt, userMessage);
        }
        else if (provider === "claude") {
            if (!storageData.claudeKey) {
                return { error: "API key for Claude not found. Please set it in the extension options." };
            }
            return await callClaude(storageData.claudeKey, systemPrompt, userMessage);
        }
        else if (provider === "openai") {
            if (!storageData.openaiKey) {
                return { error: "API key for OpenAI not found. Please set it in the extension options." };
            }
            return await callOpenAI(storageData.openaiKey, systemPrompt, userMessage);
        }
        else {
            return { error: "No AI provider selected. Please configure one in the extension options." };
        }
    } catch (error) {
        console.error("Error in handleAICall:", error);
        return { error: "An error occurred while processing your request. Please try again." };
    }
}

async function callGemini(apiKey, systemPrompt, problemContext) {
    const fullPrompt = `${systemPrompt}\n\n${problemContext}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{text: fullPrompt }] }]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { error: `Network error (${response.status}): ${errorText}` };
    }

    const data = await response.json();
    if (data.error) {
        console.error("Error from Gemini API:", data.error);
        return { error: "Error from Gemini API: " + data.error.message };
    }

    return { answer: data.candidates[0].content.parts[0].text };
}

async function callClaude(apiKey, systemPrompt, problemContext) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
            'anthropic-dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1024,
            system: systemPrompt,
            messages: [
                { role: 'user', content: problemContext }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { error: `Network error (${response.status}): ${errorText}` };
    }

    const data = await response.json();
    if (data.error) {
        console.error("Error from Claude API:", data.error);
        return { error: "Error from Claude API: " + data.error.message };
    }

    return { answer: data.content[0].text };
}

async function callOpenAI(apiKey, systemPrompt, problemContext) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: problemContext }
            ]
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        return { error: `Network error (${response.status}): ${errorText}` };
    }

    const data = await response.json();
    if (data.error) {
        console.error("Error from OpenAI API:", data.error);
        return { error: "Error from OpenAI API: " + data.error.message };
    }

    return { answer: data.choices[0].message.content };
}