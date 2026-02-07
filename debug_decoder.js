const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, 'public', 'index.html');
const content = fs.readFileSync(indexPath, 'utf8');

// Extract base64 string
const match = content.match(/var _0x = "(.*?)";/);
if (match && match[1]) {
    const encoded = match[1];
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');

    console.log('--- Decoded Content Check ---');
    console.log('Contains photoTextDetails div:', decoded.includes('id="photoTextDetails"'));
    console.log('Contains JS logic (innerHTML =):', decoded.includes('photoTextDetails.innerHTML ='));
    console.log('Contains Weather Icon logic (fa-cloud-sun):', decoded.includes('fa-cloud-sun'));

    // Optional: write to file for inspection
    // fs.writeFileSync('debug_decoded.html', decoded);
} else {
    console.log('❌ Could not find base64 string in public/index.html');
}
