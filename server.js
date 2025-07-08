const express = require('express');
const path = require('path');
const { convertCurlToVRO } = require('curl2vro');

// Create a simple in-memory cache to store converted code
const conversionCache = new Map();
const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// API endpoint for curl to vRO conversion
app.post('/api/convert', async (req, res) => {
    try {
        const { curlCommand } = req.body;
        
        if (!curlCommand) {
            return res.status(400).json({ 
                success: false,
                error: 'No curl command provided' 
            });
        }

        // Check cache first
        const cacheKey = curlCommand.trim();
        if (conversionCache.has(cacheKey)) {
            return res.json({ 
                success: true,
                result: conversionCache.get(cacheKey),
                cached: true
            });
        }

        // Convert the curl command (false = no file operations)
        const vroCode = convertCurlToVRO(curlCommand, false);
        
        // Cache the result
        conversionCache.set(cacheKey, vroCode);
        
        res.json({ 
            success: true,
            result: vroCode,
            cached: false
        });
        
    } catch (error) {
        console.error('Conversion error:', error);
        res.status(400).json({ 
            success: false,
            error: error.message || 'Failed to convert curl command' 
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the main HTML for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Close server gracefully
    server.close(() => process.exit(1));
});