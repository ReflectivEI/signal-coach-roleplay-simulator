export function createPageUrl(pageName: string) {
    return '/' + pageName.replace(/ /g, '-');
}

function cleanStructuredLine(line: string) {
    return line
        .replace(/^\s*\*\s+/, '- ')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .trimEnd();
}

export function formatStructuredAiText(input: string) {
    if (!input) return '';

    const normalized = input
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map(cleanStructuredLine)
        .join('\n')
        .trim();

    if (!normalized) return '';

    const lines = normalized.split('\n');
    const blocks: string[] = [];
    let section: { number: string; header: string; body: string[] } | null = null;
    let paragraph: string[] = [];

    const flushParagraph = () => {
        if (!paragraph.length) return;
        blocks.push(paragraph.join(' ').replace(/\s+/g, ' ').trim());
        paragraph = [];
    };

    const flushSection = () => {
        if (!section) return;
        const body = section.body.join('\n').trim();
        blocks.push(body ? `**${section.number}. ${section.header}:**\n\n${body}` : `**${section.number}. ${section.header}**`);
        section = null;
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
            if (section) {
                section.body.push('');
            } else {
                flushParagraph();
            }
            continue;
        }

        const sectionMatch = line.match(/^(\d+)\.\s*(.+)$/);
        if (sectionMatch) {
            flushParagraph();
            flushSection();
            const remainder = sectionMatch[2].trim();
            let header = remainder;
            let bodyStart = '';

            const colonIndex = remainder.indexOf(':');
            if (colonIndex !== -1) {
                header = remainder.slice(0, colonIndex).trim();
                bodyStart = remainder.slice(colonIndex + 1).trim();
            }

            section = {
                number: sectionMatch[1],
                header: header.replace(/[:.\-\s]+$/, '').trim(),
                body: bodyStart ? [bodyStart] : [],
            };
            continue;
        }

        if (section) {
            section.body.push(line);
        } else {
            paragraph.push(line);
        }
    }

    flushParagraph();
    flushSection();

    return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}
