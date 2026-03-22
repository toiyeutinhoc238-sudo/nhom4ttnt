const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\BRAVO 15\\Downloads\\co so toan trong cntt';
const dstFile = 'C:\\Users\\BRAVO 15\\Downloads\\tracuu\\assets\\data.json';

console.log('Reading target JSON file...');
let data = JSON.parse(fs.readFileSync(dstFile, 'utf8'));

// Backup
fs.writeFileSync(dstFile + '.bak', JSON.stringify(data, null, 2));

// Helper function to robustly parse LaTeX commands with nested braces like \textbf{...}
function replaceLatexCommand(text, command, openTag, closeTag) {
    let result = '';
    let i = 0;
    let searchStr = "\\" + command + "{";
    while (i < text.length) {
        let match = text.indexOf(searchStr, i);
        if (match === -1) {
            result += text.slice(i);
            break;
        }
        result += text.slice(i, match);
        i = match + searchStr.length;
        let braceCount = 1;
        let contentStart = i;
        while (i < text.length && braceCount > 0) {
            if (text[i] === '\\' && (text[i+1] === '{' || text[i+1] === '}')) {
                i += 2;
                continue;
            }
            if (text[i] === '{') braceCount++;
            else if (text[i] === '}') braceCount--;
            i++;
        }
        let content = text.slice(contentStart, i - 1);
        content = replaceLatexCommand(content, command, openTag, closeTag);
        result += openTag + content + closeTag;
    }
    return result;
}

function cleanLatexBody(body) {
    body = body.replace(/\\noindent/g, '');
    body = body.replace(/\\vspace\{[^}]+\}/g, '\n');
    body = body.replace(/\[h!\]/g, '');
    body = body.replace(/\\centering\s*/g, '');
    body = body.replace(/(?<!\\)%.*/g, '');
    
    // Handle lists
    body = body.replace(/\\begin\{itemize\}/g, '');
    body = body.replace(/\\end\{itemize\}/g, '');
    body = body.replace(/\\begin\{enumerate\}[^\n]*/g, '');
    body = body.replace(/\\end\{enumerate\}/g, '');
    body = body.replace(/\\item /g, '• ');
    
    // Handle figures and tables layout tags
    body = body.replace(/\\begin\{figure\}(?:\[[^\]]*\])?/g, '');
    body = body.replace(/\\end\{figure\}/g, '');
    body = body.replace(/\\begin\{table\}(?:\[[^\]]*\])?/g, '');
    body = body.replace(/\\end\{table\}/g, '');
    
    // Convert caption using robust syntax parsing to handle nested braces (like fractions)
    body = replaceLatexCommand(body, 'caption', '<p class="text-center text-muted small mt-2 mb-4" style="font-size: 0.85rem"><em>', '</em></p>');
    
    // Remove setcounter
    body = body.replace(/\\setcounter\{[^}]+\}\{[^}]+\}/g, '');

    // Handle includegraphics
    let imgRegex = /\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/g;
    body = body.replace(imgRegex, (m, imgName) => {
        const srcImgPath = path.join(srcDir, imgName);
        const dstImgDir = 'C:\\Users\\BRAVO 15\\Downloads\\tracuu\\assets\\images';
        if (!fs.existsSync(dstImgDir)) fs.mkdirSync(dstImgDir, { recursive: true });
        
        try {
            if (fs.existsSync(srcImgPath)) {
                fs.copyFileSync(srcImgPath, path.join(dstImgDir, path.basename(imgName)));
            } else {
                 console.log("Image not found: " + srcImgPath);
            }
        } catch(e) {}
        
        return `<div class="text-center my-3"><img src="assets/images/${path.basename(imgName)}" class="img-fluid rounded shadow-sm" style="max-height: 400px;" alt=""/></div>`;
    });
    
    // Protect and Compile TikZ block to SVG using pdflatex + pdftocairo
    body = body.replace(/\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/g, (match) => {
        const hash = require('crypto').createHash('md5').update(match).digest('hex').substring(0, 8);
        const svgFilename = `tikz_${hash}.svg`;
        const dstImgDir = 'C:\\Users\\BRAVO 15\\Downloads\\tracuu\\assets\\images';
        const svgPath = require('path').join(dstImgDir, svgFilename);
        
        if (!require('fs').existsSync(svgPath)) {
            const tmpDir = 'C:\\Users\\BRAVO 15\\Downloads\\tracuu\\tmp_tikz';
            if (!require('fs').existsSync(tmpDir)) require('fs').mkdirSync(tmpDir, { recursive: true });
            
            const texCode = `\\documentclass[tikz,border=2mm]{standalone}\n\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage[vietnamese]{babel}\n\\usepackage{amsmath,amssymb}\n\\usepackage{pgfplots}\n\\pgfplotsset{compat=newest}\n\\begin{document}\n${match}\n\\end{document}`;
            const texFile = require('path').join(tmpDir, `tmp_${hash}.tex`);
            require('fs').writeFileSync(texFile, texCode);
            try {
                require('child_process').execSync(`pdflatex -interaction=nonstopmode -halt-on-error tmp_${hash}.tex`, { cwd: tmpDir, stdio: 'ignore' });
                require('child_process').execSync(`pdftocairo -svg tmp_${hash}.pdf ${svgFilename}`, { cwd: tmpDir, stdio: 'ignore' });
                if (!require('fs').existsSync(dstImgDir)) require('fs').mkdirSync(dstImgDir, { recursive: true });
                require('fs').copyFileSync(require('path').join(tmpDir, svgFilename), svgPath);
            } catch(e) {
                console.log("Failed to compile tikz: " + hash);
                return '<div class="alert alert-secondary text-center my-3 border bg-dark text-light border-secondary"><i class="bi bi-graph-up text-muted fs-4 d-block mb-2"></i><em class="text-muted">[Lỗi biên dịch đồ thị TikZ]</em></div>';
            }
        }
        
        return `<div class="text-center my-4"><img src="assets/images/${svgFilename}" class="img-fluid rounded shadow-sm bg-white p-2" style="max-height: 400px; filter: invert(0.9) hue-rotate(180deg);" alt="TikZ Figure"/></div>`;
    });
    
    // Handle math align environments
    body = body.replace(/\\begin\{align\*?\}([\s\S]*?)\\end\{align\*?\}/g, '$$\n\\begin{aligned}$1\\end{aligned}\n$$');
    body = body.replace(/\\begin\{equation\*?\}([\s\S]*?)\\end\{equation\*?\}/g, '$$\n$1\n$$');
    
    // Replace text formatting
    body = replaceLatexCommand(body, 'textbf', '<strong>', '</strong>');
    body = replaceLatexCommand(body, 'textit', '<em>', '</em>');
    body = replaceLatexCommand(body, 'underline', '<u>', '</u>');
    
    // Clean up multicolumns after text formatting is processed
    body = body.replace(/\\multicolumn\{[^}]+\}\{[^}]+\}\{([^{}]+)\}/g, '$1');
    
    // Tables
    body = body.replace(/\\begin\{tabular\}\{[^}]+\}([\s\S]*?)\\end\{tabular\}/g, (match, inner) => {
        let html = inner.replace(/\\hline/g, '');
        html = html.replace(/\\\\ /g, '\\\\');
        let rows = html.split('\\\\').filter(r => r.trim().length > 0);
        let tableContent = rows.map(row => {
            let columns = row.split('&').map(col => `<td>${col.trim()}</td>`).join('');
            return `<tr>${columns}</tr>`;
        }).join('\n');
        return `<div class="table-responsive"><table class="table table-bordered table-dark mt-2 mb-2"><tbody>\n${tableContent}\n</tbody></table></div>`;
    });
    
    body = body.replace(/\\begin\{center\}/g, '');
    body = body.replace(/\\end\{center\}/g, '');
    body = body.replace(/\\renewcommand\{\\arraystretch\}\{[^}]+\}/g, '');
    body = body.replace(/\\setlength\{\\tabcolsep\}\{[^}]+\}/g, '');
    
    body = body.replace(/\\(\w+) /g, (m, c) => '\\' + c + ' '); // preserve math macros
    body = body.replace(/\\\\\s*\n/g, '\n');
    body = body.replace(/\\newpage/g, '');
    
    // Cleanup minipage
    body = body.replace(/\\begin\{minipage\}[^\n]*/g, '');
    body = body.replace(/\\end\{minipage\}/g, '');
    
    body = body.split('\n').map(line => line.trimStart()).join('\n');
    return body.trim();
}

let newTopics = [];
let topicIdCounter = 100;

const subjectMap = {
    1: 'gt1', 2: 'gt1', 3: 'gt1', 4: 'gt1', 5: 'gt1',
    6: 'dstt', 7: 'dstt', 8: 'dstt', 9: 'dstt', 10: 'dstt', 11: 'dstt', 12: 'dstt', 13: 'dstt', 14: 'dstt', 15: 'dstt'
};

const chapters = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

chapters.forEach(i => {
    const filePath = path.join(srcDir, `chuong${i}.tex`);
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}`);
        return;
    }
    
    let content = fs.readFileSync(filePath, 'utf8');
    console.log(`Parsing chuong${i}.tex (${content.length} bytes)...`);
    
    let currentIndex = 0;
    let exampleCount = 1;
    let tableCount = 1;
    let count = 0;
    
    while (currentIndex < content.length) {
        const boundaries = [
            { type: 'tcolorbox', regex: /\\begin\{tcolorbox\}\s*\[[\s\S]*?title=\{([^}]+)\}[\s\S]*?\]/g },
            { type: 'example', regex: /\\begin\{example\}/g },
            { type: 'table', regex: /\\begin\{table\}/g }
        ];
        
        let nearest = null;
        for (let b of boundaries) {
            b.regex.lastIndex = currentIndex;
            let match = b.regex.exec(content);
            if (match && (!nearest || match.index < nearest.match.index)) {
                nearest = { type: b.type, match: match, regex: b.regex };
            }
        }
        
        if (!nearest) break;
        
        let blockStart = nearest.match.index;
        let blockEnd, rawBody, title;
        let categoryId = 'concept';
        
        if (nearest.type === 'tcolorbox') {
            title = nearest.match[1].trim();
            const endMatch = /\\end\{tcolorbox\}/g;
            endMatch.lastIndex = blockStart;
            const end = endMatch.exec(content);
            if (end) {
                blockEnd = end.index + end[0].length;
                rawBody = content.substring(nearest.match.index + nearest.match[0].length, end.index);
            } else {
                blockEnd = content.length;
                rawBody = "";
            }
            
            const titleLower = title.toLowerCase();
            if (titleLower.includes('tính chất') || titleLower.includes('định lý') || titleLower.includes('hệ quả') || titleLower.includes('nguyên lý')) {
                categoryId = 'property';
            }
        } 
        else if (nearest.type === 'table') {
            title = `Bảng tóm tắt ${tableCount++}`;
            categoryId = 'property';
            const endMatch = /\\end\{table\}/g;
            endMatch.lastIndex = blockStart;
            const end = endMatch.exec(content);
            if (end) {
                blockEnd = end.index + end[0].length;
                rawBody = content.substring(nearest.match.index + nearest.match[0].length, end.index);
            } else {
                blockEnd = content.length;
                rawBody = "";
            }
        } 
        else if (nearest.type === 'example') {
            title = `Ví dụ minh họa ${exampleCount++}`;
            categoryId = 'exercise';
            
            let contentStart = nearest.match.index + nearest.match[0].length;
            
            let nextBoundaryIndex = content.length;
            const stopRegexes = [
                /\\begin\{tcolorbox\}/g,
                /\\begin\{example\}/g,
                /\\begin\{table\}/g,
                /\\section\{/g,
                /\\subsection\{/g
            ];
            for (let sr of stopRegexes) {
                sr.lastIndex = contentStart;
                let sm = sr.exec(content);
                if (sm && sm.index < nextBoundaryIndex) {
                    nextBoundaryIndex = sm.index;
                }
            }
            
            blockEnd = nextBoundaryIndex;
            rawBody = content.substring(contentStart, blockEnd);
            
            if (nearest.type === 'example') {
                rawBody = rawBody.replace(/\\end\{example\}/g, '');
            }
        }
        
        currentIndex = blockEnd;
        
        let cleanedBody = cleanLatexBody(rawBody);
        
        if (cleanedBody && cleanedBody.length > 0) {
            newTopics.push({
                id: `auto-${topicIdCounter++}`,
                subject_id: subjectMap[i] || 'dstt',
                category_id: categoryId,
                title: title + ` (Chương ${i})`,
                content: cleanedBody,
                tags: [title.toLowerCase()],
                related_ids: []
            });
            count++;
        }
    }
    
    // PDF document link
    newTopics.push({
        id: `auto-${topicIdCounter++}`,
        subject_id: subjectMap[i] || 'dstt',
        category_id: 'exercise',
        title: `Bài tập tổng hợp (Chương ${i})`,
        content: `
<div class="pdf-container text-center py-5">
    <div class="mb-4">
        <i class="bi bi-file-earmark-pdf-fill text-danger text-opacity-75" style="font-size: 5rem; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));"></i>
    </div>
    <h4 class="text-white mb-3">Tài liệu Bài tập Chương ${i}</h4>
    <p class="text-muted mb-4">Nhấn vào nút bên dưới để xem trực tiếp hoặc tải tài liệu bài tập PDF đầy đủ về máy.</p>
    <div class="d-flex justify-content-center gap-3 mb-4">
        <a href="assets/pdfs/chuong${i}.pdf" target="_blank" class="btn btn-outline-light rounded-pill px-4 py-2">
            <i class="bi bi-box-arrow-up-right me-2"></i> Mở cửa sổ mới
        </a>
        <a href="assets/pdfs/chuong${i}.pdf" download class="btn btn-primary rounded-pill px-4 py-2 shadow-sm" style="background: linear-gradient(45deg, #4f46e5, #9333ea); border: none;">
            <i class="bi bi-cloud-arrow-down-fill me-2"></i> Tải PDF
        </a>
    </div>
    
    <div class="mt-5 rounded-4 overflow-hidden border border-secondary border-opacity-25 d-none d-md-block shadow-lg" style="background: #1e293b; height: 80vh;">
        <object data="assets/pdfs/chuong${i}.pdf" type="application/pdf" width="100%" height="100%">
            <div class="h-100 d-flex flex-column justify-content-center align-items-center p-5">
                <i class="bi bi-exclamation-triangle text-warning fs-1 mb-3"></i>
                <p class="text-muted">Trình duyệt không hỗ trợ xem trước PDF.</p>
                <a href="assets/pdfs/chuong${i}.pdf" class="btn btn-sm btn-outline-secondary mt-2">Tải PDF xuống máy</a>
            </div>
        </object>
    </div>
</div>`.trim(),
        tags: ['bài tập', 'pdf', `chương ${i}`],
        related_ids: []
    });
    
    console.log(` -> Found ${count} blocks, added 1 PDF attachment for chapter ${i}.`);
});

data.topics = newTopics;

fs.writeFileSync(dstFile, JSON.stringify(data, null, 2));
console.log(`\nSuccessfully added ${newTopics.length} new topics from LaTeX source to data.json`);
