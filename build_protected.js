const fs = require('fs');
const path = require('path');

function processFile(fileName) {
    // Source is now in src/ folder (security best practice)
    const sourcePath = path.join(__dirname, 'src', fileName);
    // Destination is public/ folder (obfuscated code)
    const destPath = path.join(__dirname, 'public', fileName);

    if (!fs.existsSync(sourcePath)) {
        console.log(`❌ Source not found: ${sourcePath}`);
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
