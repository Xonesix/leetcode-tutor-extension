// check for msg from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === "CALL_AI") {
        // call the AI funct then return true for the async response
        handleAICall(request.scrapedData, request.mode).then(response => sendResponse(response)).catch(error => {sendResponse({ error: "An error occurred while calling the AI: " + error.message })});
        return true;
    }
});

async function handleAICall(scrapedData, mode) {
    try {
        // grab the API key from storage
        const storageData = await chrome.storage.sync.get(['activeProvider', 'geminiKey', 'claudeKey']);
        const provider = storageData.activeProvider;

        // set problem context for the AI based on the scraped data and mode
        const problemContext = `
            Problem: ${scrapedData.title} (${scrapedData.difficulty})
            Description: ${scrapedData.description}
            User Code: ${scrapedData.code}
        `;

        // set system prompt based on mode
        let systemPrompt = "";
        if (mode === "tutor") {
            systemPrompt = "You are a leetcode tutor. Give exactly one hint per question, and only provide the next step to solve the problem. Do not give the full solution. If the user asks for another hint, provide the next step. Be encouraging and supportive.";
        }
        else if (mode === "interview") {
            systemPrompt = "You are a strict technical interviewer for LeetCode problems. Review the user's code and provide feedback on correctness, efficiency, and style. Be critical but constructive. Allow the user to ask follow-up questions.";
        }
        else if (mode === "solution") {
            systemPrompt = "You are a leetcode solution explainer. Provide a clear and concise explanation of the optimal solution for the given problem. Include time and space complexity analysis.";
        }

        // call the appropriate AI provider function and if key is missing, return an error message
        if (provider === "gemini") {
            if (!storageData.geminiKey) {
                return { error: "API key for Gemini not found. Please set it in the extension options." };
            }
            return await callGemini(storageData.geminiKey, systemPrompt, problemContext);
        }
        else if (provider === "claude") {
            if (!storageData.claudeKey) {
                return { error: "API key for Claude not found. Please set it in the extension options." };
            }
            return await callClaude(storageData.claudeKey, systemPrompt, problemContext);
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