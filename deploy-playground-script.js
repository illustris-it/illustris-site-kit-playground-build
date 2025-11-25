const fs = require('fs');

const version = process.env.VERSION_DIR;
if (!version) {
    console.error('VERSION_DIR env var is required');
    process.exit(1);
}

const filePath = 'index.html';
const marker = '<!-- AUTO-VERSIONS -->';
const href = `./${version}/playground/`;
const entry =
    `          <li><a href="${href}"><span>${version}</span><span class="arrow">→</span></a></li>`;

if (!fs.existsSync(filePath)) {
    console.error('index.html not found, nothing to update.');
    process.exit(0);
}

let html = fs.readFileSync(filePath, 'utf8');

if (!html.includes(href)) {
    if (!html.includes(marker)) {
        console.error('Marker not found in index.html, nothing to update.');
        process.exit(1);
    } else {
        html = html.replace(marker, `${marker}\n${entry}`);
        fs.writeFileSync(filePath, html);
        console.log(`Added version link for ${version} to index.html`);
    }
} else {
    console.log(`Version ${version} already present in index.html, skipping`);
}
