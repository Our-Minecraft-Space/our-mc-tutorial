import MarkdownIt from 'markdown-it';
import container_plugin from 'markdown-it-container';
import fs from 'fs-extra';
import path from 'path';
import juice from 'juice';

const template1Start = `<div class="container">`;
const template1End = `</div>`

const template2Start = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        .naver-cafe-post {
            width: 743px;
            padding: 14px;
            border: 1px rgb(218, 216, 215) solid;
            margin: 0 auto;
        }
    </style>
</head>
<body>
<article class="naver-cafe-post">
`;

const template2End = `
</div>
</body>
</html>
`;

main();

async function main() {
    const config = await fs.readJson('./markcafe-config.json', 'utf8');
    if (config.generatedDirectory.endsWith('/')) config.generatedDirectory = config.generatedDirectory.slice(0, str.length - 1);
    if (!config.imgSrcPrefix.endsWith('/')) config.imgSrcPrefix += '/';

    await fs.emptyDir(config.generatedDirectory);
    await fs.copy(config.imagesDirectory, path.join(config.generatedDirectory, 'images'));
    await fs.writeFile(path.join(config.generatedDirectory, 'CNAME'), config.cname + '\n');

    const md = new MarkdownIt({
        html: true,
        breaks: true,
        typographer: true
    }).use(container_plugin, 'tip', {
        render: (tokens, idx) => {
            if (tokens[idx].nesting === 1) {
                return `<div class="tip-header">${config.tipHeaderContent}</div>\n<div class="tip">`;
            } else {
                return `</div>\n`;
            }
        }
    });
    const oldImageRule = md.renderer.rules.image;
    md.renderer.rules.image = (tokens, idx, options, env, slf) => {
        if (tokens[idx].nesting !== 0) return oldImageRule(tokens, idx, options, env, slf);
        if (tokens[idx].attrGet('src').startsWith('images/')) {
            tokens[idx].attrSet('src', config.imgSrcPrefix + tokens[idx].attrGet('src'));
        }
        let result = oldImageRule(tokens, idx, options, env, slf);
        if (idx === 0) {
            result = `<div class="img-wrapper">` + result;
        }
        if (idx === tokens.length - 1) {
            result = result + `</div>`;
        }
        return result;
    };

    const css = await fs.readFile(config.cssFile, 'utf8');

    const filenames = await fs.readdir(config.articlesDirectory);
    filenames.map(async filename => {
        const baseName = filename.replace(/\.[^/.]+$/, '');
        convertFile(md, css, path.join(config.articlesDirectory, filename), path.join(config.generatedDirectory, baseName + '.html.txt'), path.join(config.generatedDirectory, baseName + '.html'));
    }).forEach(async promise => {
        await promise;
    });
}

async function convertFile(md, css, srcPath, targetTxtPath, targetHtmlPath) {
    const src = await fs.readFile(srcPath, 'utf8');
    const rendered = md.render(src);
    const templated1 = template1Start + rendered + template1End;
    const juiced = juice.inlineContent(templated1, css, {
        inlinePseudoElements: true,
        preserveFontFaces: false,
        preserveImpotant: false,
        preserveMediaQueries: false,
        preserveKeyFrames: false,
        preservePseudos: false
    });
    const templated2 = template2Start + juiced + template2End;
    
    const txtPromise = fs.writeFile(targetTxtPath, juiced);
    const htmlPromise = fs.writeFile(targetHtmlPath, templated2);
    await txtPromise;
    await htmlPromise;
}