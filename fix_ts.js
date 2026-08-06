import fs from 'fs';
import path from 'path';

// This script will read tsc-errors.txt and apply naive fixes for unused imports
const errors = fs.readFileSync('tsc-errors.txt', 'utf-8').split('\n');

for (const err of errors) {
    const match = err.match(/^(.+?)\((\d+),\d+\): error TS6133: '(.+?)' is declared/);
    if (match) {
        const file = match[1];
        const lineNum = parseInt(match[2], 10) - 1; // 0-indexed
        const variable = match[3];
        
        let content = fs.readFileSync(file, 'utf-8').split('\n');
        let line = content[lineNum];
        
        // Naive replace: remove `Variable,` or `, Variable` or `Variable`
        // We need to be careful with spaces
        const regex1 = new RegExp(`\\b${variable}\\s*,?`);
        line = line.replace(regex1, '');
        
        // Clean up empty braces `{ }` or `{, }`
        line = line.replace(/\{\s*,?\s*\}/, '{}');
        line = line.replace(/,\s*,/, ',');
        line = line.replace(/\{\s*,/, '{ ');
        line = line.replace(/,\s*\}/, ' }');
        
        content[lineNum] = line;
        fs.writeFileSync(file, content.join('\n'), 'utf-8');
        console.log(`Fixed ${variable} in ${file}:${lineNum+1}`);
    }
    
    const matchAll = err.match(/^(.+?)\((\d+),\d+\): error TS6192: All imports in import declaration are unused/);
    if (matchAll) {
        const file = matchAll[1];
        const lineNum = parseInt(matchAll[2], 10) - 1;
        let content = fs.readFileSync(file, 'utf-8').split('\n');
        
        // If it's a multi-line import, this naive script might only delete the first line. 
        // We'll just comment out the line for now, or delete it.
        content[lineNum] = '// ' + content[lineNum];
        fs.writeFileSync(file, content.join('\n'), 'utf-8');
        console.log(`Fixed All unused in ${file}:${lineNum+1}`);
    }
    
    const matchDestruct = err.match(/^(.+?)\((\d+),\d+\): error TS6198: All destructured elements are unused/);
    if (matchDestruct) {
        const file = matchDestruct[1];
        const lineNum = parseInt(matchDestruct[2], 10) - 1;
        let content = fs.readFileSync(file, 'utf-8').split('\n');
        // e.g. const { isMobile, state } = useSidebar()
        // replace with just useSidebar()
        content[lineNum] = content[lineNum].replace(/const\s+\{.*\}\s*=\s*/, '');
        fs.writeFileSync(file, content.join('\n'), 'utf-8');
        console.log(`Fixed unused destructure in ${file}:${lineNum+1}`);
    }
}
