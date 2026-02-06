const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'index.html');
const backupPath = path.join(__dirname, 'public', 'index.html.bak');

// Read file
let html = fs.readFileSync(filePath, 'utf8');

// Create backup
fs.writeFileSync(backupPath, html);
console.log('✅ Backup created at index.html.bak');

// Define split points
const startMarker = '<body>';
const endMarker = '<!-- TensorFlow.js & BlazeFace -->';

const startIndex = html.indexOf(startMarker);
const endIndex = html.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error('❌ Could not find markers');
    process.exit(1);
}

// Extract content to be obfuscated
// logic: keep <body> tag, obfuscate everything until scripts
const bodyStart = startIndex + startMarker.length;
const contentToObfuscate = html.substring(bodyStart, endIndex);

// Encode to Base64 (supporting UTF-8)
const encoded = Buffer.from(contentToObfuscate, 'utf8').toString('base64');

// Create Obfuscation Script
// Using a slightly confusing variable naming scheme is a nice touch for "obfuscation"
const obfuscatedScript = `
    <script>
        (function() {
            var _0x4d2e = "${encoded}";
            var _0x1a8f = function(s) {
                try {
                    return decodeURIComponent(escape(window.atob(s)));
                } catch(e) {
                    console.error("Decryption failed");
                    return "";
                }
            };
            document.write(_0x1a8f(_0x4d2e));
        })();
    </script>
`;

// Reconstruct HTML
const newHtml = html.substring(0, bodyStart) + obfuscatedScript + '\n    ' + html.substring(endIndex);

// Write back
fs.writeFileSync(filePath, newHtml);
console.log('✅ index.html has been obfuscated!');
