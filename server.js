const express = require('express');
const path = require('path');
const { convertCurlToVRO } = require('curl2vro');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS for Vercel deployment
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// POST endpoint to convert curl commands
app.post('/api/convert', (req, res) => {
    try {
        const curlCommand = req.body.curlCommand;
        if (!curlCommand) {
            return res.status(400).json({ error: 'No curl command provided' });
        }

        const vroCode = convertCurlToVRO(curlCommand, false);
        res.json({ result: vroCode });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Add a catch-all route to serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});