const express = require('express');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.OPENAI_API_KEY || "sk-dummy-key";

app.use(cors());
app.use(bodyParser.json());

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: { message: "Missing Authorization header", type: "invalid_request_error" } });
    }
    const token = authHeader.replace('Bearer ', '');
    if (token !== API_KEY) {
        // console.log("Warning: Invalid API Key used"); 
    }
    next();
};


function buildPromptFromHistory(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return "";

    const validTools = ["search_file_content", "read_file", "web_fetch"];
    const toolInstructions = `Available tools: ${validTools.join(", ")}. Do NOT attempt to use "run_shell_command" or any tool not listed here. If asked to do something you cannot do with these tools, simply explain that you cannot do it.`;

    let fullPrompt = "";

    const systemMsg = messages.find(m => m.role === 'system');
    if (systemMsg) {
        fullPrompt += `System Instructions: ${systemMsg.content}\n${toolInstructions}\n\n`;
    } else {
    
        fullPrompt += `System Instructions: You are a helpful AI assistant. ${toolInstructions}\n\n`;
    }


    messages.forEach(msg => {
        if (msg.role === 'system') return;
        const role = msg.role === 'user' ? 'User' : 'Assistant';
        fullPrompt += `${role}: ${msg.content}\n`;
    });

    fullPrompt += "Assistant:"; 
    return fullPrompt;
}

app.get('/v1/models', authenticate, (req, res) => {
    res.json({
        object: "list",
        data: [
            { id: "gemini-2.0-flash", object: "model", created: Date.now(), owned_by: "google" },
            { id: "gemini-2.5-pro", object: "model", created: Date.now(), owned_by: "google" },
            { id: "gemini-2.5-flash", object: "model", created: Date.now(), owned_by: "google" }
        ]
    });
});

app.post('/v1/chat/completions', authenticate, (req, res) => {
    const { messages, model, stream } = req.body;

    if (!messages) {
        return res.status(400).json({ error: { message: "Missing messages", type: "invalid_request_error" } });
    }

    const prompt = buildPromptFromHistory(messages);
    

    const selectedModel = model || 'gemini-2.5-flash';

    const args = [
        '--prompt', prompt,
        '--output-format', 'stream-json',
        '--model', selectedModel
    ];

    console.log(`[Gemini Bridge] Spawning: gemini ${args.join(' ')}`);

    const child = spawn('gemini', args);
    
    if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
    } else {
        res.setHeader('Content-Type', 'application/json');
    }

    let accumulatedText = "";
    let isResponseSent = false;
    let buffer = ""; 

    child.stdout.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop(); 

        for (const line of lines) {
            if (!line.trim()) continue;

            try {
                const event = JSON.parse(line);
                
              
                if (event.type === 'error') {
                    console.error("Gemini Internal Error:", event);
        
                }

                if (event.type === 'message' && event.role === 'assistant') {
                    const content = event.content || "";
                    if (stream) {
                        const chunk = {
                            id: `chatcmpl-${Date.now()}`,
                            object: "chat.completion.chunk",
                            created: Math.floor(Date.now() / 1000),
                            model: selectedModel,
                            choices: [{ index: 0, delta: { content: content }, finish_reason: null }]
                        };
                        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                    } else {
                        accumulatedText += content;
                    }
                } 
                else if (event.type === 'result') {
                     if (stream) {
                        const endChunk = {
                            id: `chatcmpl-${Date.now()}`,
                            object: "chat.completion.chunk",
                            created: Math.floor(Date.now() / 1000),
                            model: selectedModel,
                            choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
                        };
                        res.write(`data: ${JSON.stringify(endChunk)}\n\n`);
                        res.write('data: [DONE]\n\n');
                        res.end();
                    } else {
                         if (!isResponseSent) {
                             res.json({
                                 id: `chatcmpl-${Date.now()}`,
                                 object: "chat.completion",
                                 created: Math.floor(Date.now() / 1000),
                                 model: selectedModel,
                                 choices: [{
                                     index: 0,
                                     message: { role: "assistant", content: accumulatedText },
                                     finish_reason: "stop"
                                 }]
                             });
                             isResponseSent = true;
                         }
                    }
                }
            } catch (e) {
       
            }
        }
    });

    child.stderr.on('data', (data) => {
        const errText = data.toString();
        console.error(`stderr: ${errText}`);

        if (errText.includes("Error executing tool") && !isResponseSent && !stream) {
  
        }
    });

    child.on('close', (code) => {
        if (code !== 0 && !isResponseSent && !stream) {
             res.status(500).json({ error: { message: "Gemini CLI Process Failed", code: code } });
        } else if (!isResponseSent && !stream) {
    
             res.json({
                 id: `chatcmpl-${Date.now()}`,
                 object: "chat.completion",
                 choices: [{
                     index: 0,
                     message: { role: "assistant", content: accumulatedText },
                     finish_reason: "stop"
                 }]
             });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Gemini-to-OpenAI Bridge running on http://localhost:${PORT}`);
});
