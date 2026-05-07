<script>
	import { browser } from '$app/environment';
	import { tick } from 'svelte';

	import { renderAssistantMarkdown } from '$lib/assistant-markdown';
	import {
		dispatchAssistantRefresh,
		loadAssistantHistory,
		sendAssistantChat
	} from '$lib/assistant-client';

	let { open = false, username = '', currentPath = '', onClose = () => {} } = $props();

	let messages = $state([]);
	let draft = $state('');
	let errorMessage = $state('');
	let isSending = $state(false);
	let isLoadingHistory = $state(false);
	let historyLoaded = $state(false);
	let historyAttempted = $state(false);
	let loadedHistoryForUsername = $state('');
	let scrollViewport = $state(null);
	let draftInput = $state(null);
	const MAX_CONVERSATION_MESSAGES = 12;
	const HISTORY_LOAD_LIMIT = 12;
	const MAX_MESSAGE_CONTENT_LENGTH = 8000;

	function closeDrawer() {
		onClose();
	}

	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			closeDrawer();
		}
	}

	function buildConversationPayload(nextMessages) {
		return nextMessages.slice(-MAX_CONVERSATION_MESSAGES).map((message) => ({
			role: message.role,
			content: String(message.content || '').slice(0, MAX_MESSAGE_CONTENT_LENGTH)
		}));
	}

	async function focusInput() {
		await tick();
		draftInput?.focus();
	}

	async function scrollToBottom() {
		await tick();

		if (scrollViewport) {
			scrollViewport.scrollTop = scrollViewport.scrollHeight;
		}
	}

	async function hydrateHistory({ force = false } = {}) {
		if (isLoadingHistory || (historyLoaded && !force)) {
			return;
		}

		isLoadingHistory = true;
		errorMessage = '';

		try {
			const persistedMessages = await loadAssistantHistory({
				limit: HISTORY_LOAD_LIMIT
			});
			messages = persistedMessages;
			historyLoaded = true;
			await scrollToBottom();
		} catch (error) {
			errorMessage = error.message;
		} finally {
			isLoadingHistory = false;

			if (open) {
				await focusInput();
			}
		}
	}

	async function submitDraft() {
		const content = draft.trim();

		if (!content || isSending || isLoadingHistory) {
			return;
		}

		errorMessage = '';
		const userMessage = {
			role: 'user',
			content
		};
		const nextMessages = [...messages, userMessage];
		messages = nextMessages;
		draft = '';
		isSending = true;
		await scrollToBottom();

		try {
			const response = await sendAssistantChat({
				messages: buildConversationPayload(nextMessages),
				timezoneOffsetMinutes: new Date().getTimezoneOffset(),
				currentPath
			});

			messages = [
				...nextMessages,
				{
					role: 'assistant',
					content: response.reply || 'No usable reply.',
					actions: response.actions
				}
			];

			if (response.refresh.tasks || response.refresh.stats || response.refresh.panic) {
				dispatchAssistantRefresh(response.refresh);
			}

			await scrollToBottom();
		} catch (error) {
			errorMessage = error.message;
		} finally {
			isSending = false;
			await focusInput();
		}
	}

	async function handleSubmit(event) {
		event.preventDefault();
		await submitDraft();
	}

	async function handleTextareaKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			await submitDraft();
		}
	}

	$effect(() => {
		if ((username || '') === loadedHistoryForUsername) {
			return;
		}

		loadedHistoryForUsername = username || '';
		messages = [];
		draft = '';
		errorMessage = '';
		historyLoaded = false;
		historyAttempted = false;
	});

	$effect(() => {
		if (!open) {
			historyAttempted = false;
			return;
		}

		if (!historyLoaded && !historyAttempted) {
			historyAttempted = true;
			void hydrateHistory();
			return;
		}

		void focusInput();
		void scrollToBottom();
	});

	$effect(() => {
		if (!browser || !open) {
			return;
		}

		const previousOverscrollBehavior = document.body.style.overscrollBehavior;
		document.body.style.overscrollBehavior = 'contain';

		return () => {
			document.body.style.overscrollBehavior = previousOverscrollBehavior;
		};
	});
</script>

{#if open}
	<div class="assistant-backdrop" role="presentation" tabindex="-1" onclick={handleBackdropClick}>
		<aside class="assistant-drawer" aria-label="Task Monster AI assistant">
			<button
				class="assistant-close"
				type="button"
				aria-label="Close assistant"
				onclick={closeDrawer}
			>
				×
			</button>

			<div class="assistant-thread" bind:this={scrollViewport}>
				{#if isLoadingHistory}
					<article class="message-row">
						<div class="message-bubble message-bubble-pending">
							<p>Loading history…</p>
						</div>
					</article>
				{/if}

				{#if messages.length > 0}
					{#each messages as message, index (message.id || `${message.role}-${index}`)}
						<article
							class:user-message={message.role === 'user'}
							class:assistant-message={message.role === 'assistant'}
							class="message-row"
						>
							<div class="message-bubble">
								{#if message.role === 'assistant'}
									<div class="assistant-markdown">
										{@html renderAssistantMarkdown(message.content)}
									</div>
								{:else}
									<p>{message.content}</p>
								{/if}

								{#if message.role === 'assistant' && Array.isArray(message.actions) && message.actions.length > 0}
									<div class="message-actions">
										{#each message.actions as action, actionIndex (`${action.type}-${actionIndex}`)}
											<span>{action.label}</span>
										{/each}
									</div>
								{/if}
							</div>
						</article>
					{/each}
				{/if}

				{#if isSending}
					<article class="message-row">
						<div class="message-bubble message-bubble-pending">
							<p>Working…</p>
						</div>
					</article>
				{/if}
			</div>

			{#if errorMessage}
				<p class="assistant-error">{errorMessage}</p>
			{/if}

			<form class="assistant-composer" onsubmit={handleSubmit}>
				<textarea
					bind:this={draftInput}
					bind:value={draft}
					rows="1"
					placeholder="Ask Task Monster"
					disabled={isSending || isLoadingHistory}
					onkeydown={handleTextareaKeydown}
				></textarea>

				<button type="submit" disabled={isSending || isLoadingHistory || !draft.trim()}>
					{isSending ? 'Working…' : 'Send'}
				</button>
			</form>
		</aside>
	</div>
{/if}

<style>
	.assistant-backdrop {
		position: fixed;
		inset: 0;
		z-index: 85;
		display: flex;
		justify-content: flex-end;
		background: color-mix(in srgb, var(--app-bg-color) 48%, transparent);
		backdrop-filter: blur(14px);
		overscroll-behavior: contain;
		animation: assistant-backdrop-in 0.18s ease both;
	}

	.assistant-drawer {
		position: relative;
		width: min(100%, 36rem);
		height: 100dvh;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto auto;
		background:
			radial-gradient(
				circle at top left,
				color-mix(in srgb, var(--color-accent) 18%, transparent),
				transparent 35%
			),
			radial-gradient(
				circle at 80% 20%,
				color-mix(in srgb, var(--color-theme-1) 12%, transparent),
				transparent 30%
			),
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--surface-3) 98%, transparent),
				color-mix(in srgb, var(--surface-1) 98%, transparent)
			);
		border-left: 1px solid var(--surface-border);
		box-shadow: -28px 0 64px color-mix(in srgb, var(--color-heading) 22%, transparent);
		color: var(--color-text);
		animation: assistant-drawer-slide-in 0.28s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	.assistant-close {
		position: absolute;
		top: 0.9rem;
		right: 0.9rem;
		z-index: 3;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border: 1px solid var(--surface-border);
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface-2) 70%, transparent);
		box-shadow: var(--surface-shadow);
		color: var(--color-soft);
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1;
		opacity: 0.72;
		cursor: pointer;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			opacity 0.18s ease,
			background 0.18s ease;
	}

	.assistant-close:hover {
		transform: translateY(-1px);
		opacity: 1;
		background: var(--surface-2);
		box-shadow: var(--surface-shadow-strong);
	}

	.assistant-thread {
		overflow-y: auto;
		display: grid;
		align-content: end;
		gap: 0.85rem;
		padding: 3.5rem 1rem 0.75rem;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.assistant-thread::-webkit-scrollbar {
		display: none;
	}

	.message-bubble p,
	.assistant-error {
		margin: 0;
	}

	.message-row {
		display: flex;
		justify-content: flex-start;
	}

	.message-row.user-message {
		justify-content: flex-end;
	}

	.message-bubble {
		max-width: 94%;
		display: grid;
		gap: 0.7rem;
		padding: 0.9rem 1rem;
		border-radius: 22px;
		background: var(--surface-2);
		border: 1px solid var(--surface-border);
		box-shadow: var(--surface-inset);
	}

	.assistant-message .message-bubble {
		background:
			linear-gradient(
				180deg,
				color-mix(in srgb, var(--surface-3) 86%, transparent),
				color-mix(in srgb, var(--surface-2) 88%, transparent)
			),
			radial-gradient(
				circle at top left,
				color-mix(in srgb, var(--color-accent) 12%, transparent),
				transparent 52%
			);
		border-color: color-mix(in srgb, var(--color-accent) 18%, var(--surface-border));
		box-shadow: var(--surface-shadow), var(--surface-inset);
	}

	.user-message .message-bubble {
		max-width: 86%;
		background: var(--accent-gradient);
		border-color: color-mix(in srgb, var(--color-accent) 24%, var(--surface-border));
		color: var(--color-accent-contrast);
		box-shadow: 0 16px 32px color-mix(in srgb, var(--color-accent) 22%, transparent);
	}

	.user-message .message-bubble p,
	.message-bubble-pending p {
		white-space: pre-wrap;
		line-height: 1.5;
	}

	.assistant-markdown {
		--md-text: var(--color-text);
		--md-soft-text: var(--color-muted);
		--md-pink: var(--color-theme-1);
		--md-cyan: var(--color-accent);
		--md-lime: var(--color-success);
		--md-violet: var(--color-accent-2);
		--md-surface: var(--surface-muted);
		--md-surface-strong: var(--surface-2);
		--md-border: var(--surface-border-strong);
		color: var(--md-text);
		font-size: 0.95rem;
		line-height: 1.62;
	}

	.assistant-markdown :global(h1),
	.assistant-markdown :global(h2),
	.assistant-markdown :global(h3),
	.assistant-markdown :global(h4),
	.assistant-markdown :global(h5),
	.assistant-markdown :global(h6) {
		margin: 0;
		font-weight: 800;
		letter-spacing: -0.03em;
		color: var(--color-heading);
		text-wrap: balance;
	}

	.assistant-markdown :global(h1) {
		font-size: 1.18rem;
	}

	.assistant-markdown :global(h2) {
		font-size: 1.08rem;
	}

	.assistant-markdown :global(h3),
	.assistant-markdown :global(h4),
	.assistant-markdown :global(h5),
	.assistant-markdown :global(h6) {
		font-size: 0.96rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--md-cyan);
	}

	.assistant-markdown :global(p),
	.assistant-markdown :global(ul),
	.assistant-markdown :global(ol),
	.assistant-markdown :global(blockquote),
	.assistant-markdown :global(pre),
	.assistant-markdown :global(hr) {
		margin: 0.72rem 0 0;
	}

	.assistant-markdown :global(p:first-child),
	.assistant-markdown :global(h1:first-child),
	.assistant-markdown :global(h2:first-child),
	.assistant-markdown :global(h3:first-child),
	.assistant-markdown :global(h4:first-child),
	.assistant-markdown :global(h5:first-child),
	.assistant-markdown :global(h6:first-child) {
		margin-top: 0;
	}

	.assistant-markdown :global(ul),
	.assistant-markdown :global(ol) {
		padding-left: 1.2rem;
		color: var(--md-soft-text);
	}

	.assistant-markdown :global(li + li) {
		margin-top: 0.3rem;
	}

	.assistant-markdown :global(li)::marker {
		color: var(--md-pink);
	}

	.assistant-markdown :global(strong) {
		color: var(--color-heading);
		font-weight: 800;
	}

	.assistant-markdown :global(em) {
		color: var(--color-theme-1);
	}

	.assistant-markdown :global(a) {
		color: var(--md-cyan);
		text-decoration: underline;
		text-decoration-color: color-mix(in srgb, var(--color-accent) 42%, transparent);
		text-underline-offset: 0.18em;
	}

	.assistant-markdown :global(code) {
		padding: 0.14rem 0.4rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-accent) 12%, var(--surface-1));
		border: 1px solid color-mix(in srgb, var(--color-accent) 16%, var(--surface-border));
		color: var(--md-lime);
		font-size: 0.88em;
		font-family: 'Fira Mono', monospace;
	}

	.assistant-markdown :global(.md-pre) {
		padding: 0.95rem 1rem;
		border-radius: 20px;
		background:
			linear-gradient(180deg, var(--md-surface-strong), var(--surface-1)),
			linear-gradient(
				135deg,
				color-mix(in srgb, var(--color-theme-1) 12%, transparent),
				color-mix(in srgb, var(--color-accent) 12%, transparent)
			);
		border: 1px solid var(--md-border);
		box-shadow: var(--surface-inset), var(--surface-shadow);
		overflow-x: auto;
	}

	.assistant-markdown :global(.md-pre code) {
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: var(--color-text);
		font-size: 0.86rem;
		line-height: 1.6;
	}

	.assistant-markdown :global(blockquote) {
		padding: 0.75rem 0.9rem;
		border-left: 3px solid var(--md-pink);
		border-radius: 0 18px 18px 0;
		background: linear-gradient(
			135deg,
			color-mix(in srgb, var(--color-theme-1) 10%, var(--surface-1)),
			color-mix(in srgb, var(--color-accent) 8%, var(--surface-1))
		);
		color: var(--color-muted);
	}

	.assistant-markdown :global(blockquote > p),
	.assistant-markdown :global(blockquote > ul),
	.assistant-markdown :global(blockquote > ol) {
		margin-top: 0.6rem;
	}

	.assistant-markdown :global(blockquote > :first-child) {
		margin-top: 0;
	}

	.assistant-markdown :global(hr) {
		border: 0;
		height: 1px;
		background: linear-gradient(
			90deg,
			transparent,
			color-mix(in srgb, var(--color-theme-1) 80%, transparent),
			color-mix(in srgb, var(--color-accent) 85%, transparent),
			transparent
		);
	}

	.message-bubble-pending {
		opacity: 0.78;
	}

	.message-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.message-actions span {
		display: inline-flex;
		align-items: center;
		padding: 0.35rem 0.55rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--color-success) 14%, var(--surface-1));
		border: 1px solid color-mix(in srgb, var(--color-success) 22%, var(--surface-border));
		box-shadow: var(--surface-inset);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: var(--color-success);
	}

	.user-message .message-actions span {
		background: color-mix(in srgb, var(--color-accent-contrast) 16%, transparent);
		border-color: color-mix(in srgb, var(--color-accent-contrast) 18%, transparent);
		color: var(--color-accent-contrast);
	}

	.assistant-error {
		padding: 0 1.15rem;
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--color-danger);
	}

	.assistant-composer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 0.7rem;
		padding: 0.85rem 1rem 1rem;
		border-top: 1px solid var(--surface-border);
	}

	.assistant-composer textarea {
		width: 100%;
		min-height: 3.15rem;
		max-height: 8rem;
		padding: 0.95rem 1rem;
		border-radius: 18px;
		border: 1px solid var(--field-border);
		background: var(--field-bg);
		box-shadow: var(--surface-inset);
		font: inherit;
		color: var(--color-text);
		line-height: 1.45;
		resize: none;
	}

	.assistant-composer textarea::placeholder {
		color: var(--color-soft);
	}

	.assistant-composer textarea:focus {
		outline: none;
		border-color: color-mix(in srgb, var(--color-accent) 34%, var(--field-border));
		box-shadow: 0 0 0 3px var(--focus-ring);
	}

	.assistant-composer button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 6.6rem;
		min-height: 3.15rem;
		padding: 0.75rem 1.05rem;
		border: 0;
		border-radius: 18px;
		background: var(--accent-gradient);
		box-shadow: 0 16px 28px color-mix(in srgb, var(--color-accent) 28%, transparent);
		color: var(--color-accent-contrast);
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}

	.assistant-composer button:disabled,
	.assistant-composer textarea:disabled {
		cursor: wait;
		opacity: 0.72;
	}

	@media (max-width: 640px) {
		.assistant-drawer {
			width: 100%;
		}

		.message-bubble {
			max-width: 92%;
		}

		.assistant-composer button {
			min-width: 5.2rem;
		}
	}

	@keyframes assistant-backdrop-in {
		from {
			opacity: 0;
		}

		to {
			opacity: 1;
		}
	}

	@keyframes assistant-drawer-slide-in {
		from {
			opacity: 0.92;
			transform: translateX(2.4rem);
		}

		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.assistant-backdrop,
		.assistant-drawer {
			animation: none;
		}
	}
</style>
