function escapeHtml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function isSafeHref(value) {
	return /^https?:\/\/[^\s]+$/i.test(value);
}

function renderInlineMarkdown(value) {
	const codeSpans = [];
	let html = escapeHtml(value);

	html = html.replace(/`([^`\n]+)`/g, (_, code) => {
		const placeholder = `@@CODE_SPAN_${codeSpans.length}@@`;
		codeSpans.push(`<code>${escapeHtml(code)}</code>`);
		return placeholder;
	});

	html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
		const safeHref = href.trim();

		if (!isSafeHref(safeHref)) {
			return escapeHtml(label);
		}

		return `<a href="${safeHref}" target="_blank" rel="noreferrer">${label}</a>`;
	});

	html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
	html = html.replace(/~~(.+?)~~/g, '<s>$1</s>');
	html = html.replace(/(^|[\s(>])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
	html = html.replace(/(^|[\s(>])_([^_\n]+)_(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');

	for (const [index, codeSpan] of codeSpans.entries()) {
		html = html.replace(`@@CODE_SPAN_${index}@@`, codeSpan);
	}

	return html;
}

function isBlankLine(line) {
	return line.trim().length === 0;
}

function isFenceLine(line) {
	return /^```/.test(line.trim());
}

function isHeadingLine(line) {
	return /^(#{1,6})\s+/.test(line.trim());
}

function isUnorderedListLine(line) {
	return /^\s*[-*+]\s+/.test(line);
}

function isOrderedListLine(line) {
	return /^\s*\d+\.\s+/.test(line);
}

function isBlockquoteLine(line) {
	return /^\s*>\s?/.test(line);
}

function isHorizontalRuleLine(line) {
	return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function isBlockStart(line) {
	return (
		isFenceLine(line) ||
		isHeadingLine(line) ||
		isUnorderedListLine(line) ||
		isOrderedListLine(line) ||
		isBlockquoteLine(line) ||
		isHorizontalRuleLine(line)
	);
}

export function renderAssistantMarkdown(markdown) {
	const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
	const blocks = [];

	for (let index = 0; index < lines.length; ) {
		const line = lines[index];
		const trimmedLine = line.trim();

		if (isBlankLine(line)) {
			index += 1;
			continue;
		}

		if (isFenceLine(line)) {
			const language = trimmedLine.slice(3).trim();
			index += 1;
			const codeLines = [];

			while (index < lines.length && !isFenceLine(lines[index])) {
				codeLines.push(lines[index]);
				index += 1;
			}

			if (index < lines.length) {
				index += 1;
			}

			const languageClass = language ? ` class="language-${escapeHtml(language)}"` : '';
			blocks.push(
				`<pre class="md-pre"><code${languageClass}>${escapeHtml(codeLines.join('\n'))}</code></pre>`
			);
			continue;
		}

		if (isHeadingLine(line)) {
			const [, hashes, content] = trimmedLine.match(/^(#{1,6})\s+(.*)$/) || [];
			const level = Math.min(6, hashes.length);
			blocks.push(`<h${level}>${renderInlineMarkdown(content)}</h${level}>`);
			index += 1;
			continue;
		}

		if (isHorizontalRuleLine(line)) {
			blocks.push('<hr />');
			index += 1;
			continue;
		}

		if (isBlockquoteLine(line)) {
			const quoteLines = [];

			while (index < lines.length && isBlockquoteLine(lines[index])) {
				quoteLines.push(lines[index].replace(/^\s*>\s?/, ''));
				index += 1;
			}

			blocks.push(`<blockquote>${renderAssistantMarkdown(quoteLines.join('\n'))}</blockquote>`);
			continue;
		}

		if (isUnorderedListLine(line) || isOrderedListLine(line)) {
			const ordered = isOrderedListLine(line);
			const tagName = ordered ? 'ol' : 'ul';
			const items = [];

			while (index < lines.length) {
				const listLine = lines[index];
				const matchesCurrentListType = ordered
					? isOrderedListLine(listLine)
					: isUnorderedListLine(listLine);

				if (!matchesCurrentListType) {
					break;
				}

				const itemContent = ordered
					? listLine.replace(/^\s*\d+\.\s+/, '')
					: listLine.replace(/^\s*[-*+]\s+/, '');
				items.push(`<li>${renderInlineMarkdown(itemContent)}</li>`);
				index += 1;
			}

			blocks.push(`<${tagName}>${items.join('')}</${tagName}>`);
			continue;
		}

		const paragraphLines = [line];
		index += 1;

		while (index < lines.length && !isBlankLine(lines[index]) && !isBlockStart(lines[index])) {
			paragraphLines.push(lines[index]);
			index += 1;
		}

		blocks.push(
			`<p>${paragraphLines
				.map((paragraphLine) => renderInlineMarkdown(paragraphLine.trim()))
				.join('<br />')}</p>`
		);
	}

	return blocks.join('');
}
