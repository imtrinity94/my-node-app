const express = require('express');
const { convertCurlToVRO } = require('curl2vro');  // Changed from './curl2vRO' to 'curl2vro'
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));

// POST endpoint to convert curl commands
app.post('/convert', (req, res) => {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});