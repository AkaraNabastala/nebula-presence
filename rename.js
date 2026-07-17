const fs = require('fs');
const path = require('path');

const dirs = [
    path.join(__dirname, 'src'),
    path.join(__dirname, 'backend')
];

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content
        .replace(/label_unit/g, 'label_kelompok')
        .replace(/label_anggota/g, 'label_pengguna');
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated: ${filePath}`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            replaceInFile(fullPath);
        }
    }
}

dirs.forEach(dir => {
    if (fs.existsSync(dir)) walkDir(dir);
});
console.log('Replacement complete.');
