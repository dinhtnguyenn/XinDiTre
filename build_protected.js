const fs = require('fs');
const path = require('path');

function processFile(fileName) {
    const backupName = fileName + '.bak';
    const sourcePath = path.join(__dirname, 'public', backupName);
    const destPath = path.join(__dirname, 'public', fileName);

    if (!fs.existsSync(sourcePath)) {
        console.log(`❌ Source not found: ${backupName}`);
        return;
    }

    let html = fs.readFileSync(sourcePath, 'utf8');

    // 1. Inline Scripts
    const scriptsToInline = ['js/protect.js', 'js/theme.js', 'js/app.js', 'js/admin.js'];

    scriptsToInline.forEach(scriptRelPath => {
        const fullScriptPath = path.join(__dirname, 'public', scriptRelPath);
        if (fs.existsSync(fullScriptPath)) {
            let jsContent = fs.readFileSync(fullScriptPath, 'utf8');

            // Escape closing script tags to prevent HTML breakage
            jsContent = jsContent.replace(/<\/script>/g, '<\\/script>');

            // Replace <script src="..."> with inline content
            // Regex handles optional whitespace
            const regex = new RegExp(`<script\\s+src="${scriptRelPath}"><\\/script>`, 'g');

            if (regex.test(html)) {
                html = html.replace(regex, `<script>\n${jsContent}\n</script>`);
                console.log(`   Detailed: Inlined ${scriptRelPath}`);
            }
        }
    });

    // 2. Obfuscate Body Content
    // We want to hide the DOM structure and the inlined scripts
    // Strategy: Encode everything between <body> and the external libraries at the end

    let startTag = '<body>';
    let startIndex = html.indexOf(startTag);
    if (startIndex === -1) {
        startTag = '<body class="admin-page">'; // For admin.html
        startIndex = html.indexOf(startTag);
    }

    // End Marker: We assume the external libraries (Leaflet, TensorFlow) start the "non-obfuscated" scripts
    // or just obfuscate until </body> if we are confident the libraries are fine being rewritten (they are).
    // However, loading external scripts via document.write can be tricky with race conditions.
    // Ideally we keep external <script src> outside the obfuscated block if possible, OR we include them in the obfuscation string (which renders them via document.write, usually fine for blocking scripts).

    // Let's try to find a safe end marker.
    // For index.html: <!-- TensorFlow.js
    // For admin.html: <script src="https://unpkg.com/leaflet...

    // Actually, to be safe and simple: Obfuscate everything!
    // But <html> and <head> are needed.

    if (startIndex !== -1) {
        const bodyContentStart = startIndex + startTag.length;
        const bodyEndIndex = html.lastIndexOf('</body>');

        if (bodyEndIndex !== -1) {
            const contentToObfuscate = html.substring(bodyContentStart, bodyEndIndex);

            // Encode
            const encoded = Buffer.from(contentToObfuscate, 'utf8').toString('base64');

            // Create Decoder Script
            const decoder = `
    <script>
        (function() {
            var _0x = "${encoded}";
            document.write(decodeURIComponent(escape(window.atob(_0x))));
        })();
    </script>
            `;

            html = html.substring(0, bodyContentStart) + decoder + html.substring(bodyEndIndex);
            console.log(`   Detailed: Obfuscated body content for ${fileName}`);
        }
    }

    fs.writeFileSync(destPath, html);
    console.log(`✅ Successfully built protected ${fileName}`);
}

console.log('Building protected files...');
processFile('index.html');
processFile('admin.html');
