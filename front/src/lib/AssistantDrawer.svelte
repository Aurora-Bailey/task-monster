<script>
	import { browser } from '$app/environment';
	import { tick } from 'svelte';

	import { renderAssistantMarkdown } from '$lib/assistant-markdown';
	import { dispatchAssistantRefresh, sendAssistantChat } from '$lib/assistant-client';

	let {
		open = false,
		username = '',
		currentPath = '',
		onClose = () => {}
	} = $props();

	let messages = $state([]);
	let draft = $state('');
	let errorMessage = $state('');
	let isSending = $state(false);
	let scrollViewport = $state(null);
	let draftInput = $state(null);

	function closeDrawer() {
		onClose();
	}

	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			closeDrawer();
		}
	}

	function handleBackdropKeydown(event) {
		if (event.key === 'Escape') {
			closeDrawer();
		}
	}

	function buildConversationPayload(nextMessages) {
		return nextMessages.map((message) => ({
			role: message.role,
			content: message.content
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

	async function submitDraft() {
		const content = draft.trim();

		if (!content || isSending) {
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
					content: response.reply || 'I didn’t get a usable reply back.',
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

	function handleWindowKeydown(event) {
		if (event.key === 'Escape' && !isSending) {
			closeDrawer();
		}
	}

	$effect(() => {
		if (!open) {
			return;
		}

		void focusInput();
		void scrollToBottom();
	});

	$effect(() => {
		if (!browser || !open) {
			return;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

{#if open}
	<div
		class="assistant-backdrop"
		role="presentation"
		tabindex="-1"
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
	>
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
				{#if messages.length === 0}
					<section class="assistant-intro">
						<p>Try things like:</p>
						<ul>
							<li>`start the homework task`</li>
							<li>`make a becoming task called journal reset`</li>
							<li>`summarize my day so far`</li>
							<li>`pause the dev task and queue laundry`</li>
						</ul>
					</section>
				{:else}
					{#each messages as message, index (`${message.role}-${index}`)}
						<article
							class:user-message={message.role === 'user'}
							class:assistant-message={message.role === 'assistant'}
							class="message-row"
						>
							<div class="message-bubble">
								{#if message.role === 'assistant'}
									<div class="assistant-markdown">{@html renderAssistantMarkdown(message.content)}</div>
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
							<p>Working through the board…</p>
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
					placeholder="Ask Task Monster to do something on your account"
					disabled={isSending}
					onkeydown={handleTextareaKeydown}
				></textarea>

				<button type="submit" disabled={isSending || !draft.trim()}>
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
		background: rgba(7, 12, 18, 0.38);
		backdrop-filter: blur(14px);
	}

	.assistant-drawer {
		position: relative;
		width: min(100%, 36rem);
		height: 100dvh;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto auto;
		background:
			radial-gradient(circle at top left, rgba(74, 111, 214, 0.18), transparent 35%),
			radial-gradient(circle at 80% 20%, rgba(138, 91, 209, 0.16), transparent 28%),
			linear-gradient(180deg, rgba(18, 26, 38, 0.98), rgba(10, 14, 22, 0.98));
		border-left: 1px solid rgba(146, 169, 196, 0.16);
		box-shadow: -28px 0 64px rgba(0, 0, 0, 0.3);
		color: rgba(244, 248, 252, 0.92);
	}

	.assistant-close {
		position: absolute;
		top: 0.9rem;
		right: 0.9rem;
		z-index: 3;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.9rem;
		height: 2.9rem;
		border: 1px solid rgba(255, 131, 221, 0.26);
		border-radius: 999px;
		background:
			radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.22), transparent 42%),
			linear-gradient(135deg, rgba(255, 84, 190, 0.82), rgba(115, 236, 255, 0.72) 62%, rgba(116, 88, 255, 0.8));
		box-shadow:
			0 0 0 1px rgba(111, 225, 255, 0.08),
			0 16px 32px rgba(10, 8, 28, 0.34),
			0 0 24px rgba(255, 91, 205, 0.26);
		color: white;
		font-size: 1.55rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			filter 0.18s ease;
	}

	.assistant-close:hover {
		transform: translateY(-1px) scale(1.02);
		filter: saturate(1.08) brightness(1.04);
		box-shadow:
			0 0 0 1px rgba(111, 225, 255, 0.12),
			0 20px 40px rgba(10, 8, 28, 0.38),
			0 0 34px rgba(255, 91, 205, 0.34);
	}

	.assistant-thread {
		overflow-y: auto;
		display: grid;
		align-content: end;
		gap: 0.85rem;
		padding: 4.2rem 1rem 0.75rem;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.assistant-thread::-webkit-scrollbar {
		display: none;
	}

	.assistant-intro {
		display: grid;
		gap: 0.8rem;
		padding: 1rem;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(146, 169, 196, 0.12);
	}

	.assistant-intro p,
	.assistant-intro li,
	.message-bubble p,
	.assistant-error {
		margin: 0;
	}

	.assistant-intro ul {
		margin: 0;
		padding-left: 1.1rem;
		display: grid;
		gap: 0.45rem;
		color: rgba(222, 231, 241, 0.78);
		font-size: 0.92rem;
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
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(146, 169, 196, 0.12);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
	}

	.assistant-message .message-bubble {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03)),
			linear-gradient(135deg, rgba(255, 74, 190, 0.16), rgba(83, 242, 255, 0.12) 52%, rgba(157, 110, 255, 0.16));
		border-color: rgba(255, 133, 217, 0.18);
		box-shadow:
			0 18px 34px rgba(5, 8, 18, 0.28),
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			inset 0 0 0 1px rgba(95, 242, 255, 0.08);
	}

	.user-message .message-bubble {
		max-width: 86%;
		background: linear-gradient(135deg, rgba(74, 111, 214, 0.86), rgba(59, 86, 168, 0.92));
		border-color: rgba(132, 186, 255, 0.18);
		color: white;
	}

	.user-message .message-bubble p,
	.message-bubble-pending p {
		white-space: pre-wrap;
		line-height: 1.5;
	}

	.assistant-markdown {
		--md-text: rgba(243, 246, 255, 0.92);
		--md-soft-text: rgba(213, 222, 245, 0.8);
		--md-pink: #ff7ad9;
		--md-cyan: #69efff;
		--md-lime: #d8ff72;
		--md-violet: #ae8dff;
		--md-surface: rgba(10, 13, 28, 0.36);
		--md-surface-strong: rgba(12, 18, 36, 0.72);
		--md-border: rgba(111, 225, 255, 0.18);
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
		color: white;
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
		color: white;
		font-weight: 800;
	}

	.assistant-markdown :global(em) {
		color: #ffe8ff;
	}

	.assistant-markdown :global(a) {
		color: var(--md-cyan);
		text-decoration: underline;
		text-decoration-color: rgba(105, 239, 255, 0.42);
		text-underline-offset: 0.18em;
	}

	.assistant-markdown :global(code) {
		padding: 0.14rem 0.4rem;
		border-radius: 999px;
		background: rgba(94, 255, 242, 0.12);
		border: 1px solid rgba(105, 239, 255, 0.14);
		color: var(--md-lime);
		font-size: 0.88em;
		font-family: 'Fira Mono', monospace;
	}

	.assistant-markdown :global(.md-pre) {
		padding: 0.95rem 1rem;
		border-radius: 20px;
		background:
			linear-gradient(180deg, rgba(15, 21, 42, 0.98), rgba(8, 11, 24, 0.96)),
			linear-gradient(135deg, rgba(255, 122, 217, 0.16), rgba(105, 239, 255, 0.14));
		border: 1px solid var(--md-border);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.04),
			0 14px 30px rgba(0, 0, 0, 0.22);
		overflow-x: auto;
	}

	.assistant-markdown :global(.md-pre code) {
		padding: 0;
		border: 0;
		border-radius: 0;
		background: transparent;
		color: #d7e8ff;
		font-size: 0.86rem;
		line-height: 1.6;
	}

	.assistant-markdown :global(blockquote) {
		padding: 0.75rem 0.9rem;
		border-left: 3px solid var(--md-pink);
		border-radius: 0 18px 18px 0;
		background: linear-gradient(135deg, rgba(255, 122, 217, 0.1), rgba(105, 239, 255, 0.08));
		color: rgba(244, 232, 255, 0.9);
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
		background: linear-gradient(90deg, rgba(255, 122, 217, 0), rgba(255, 122, 217, 0.8), rgba(105, 239, 255, 0.85), rgba(255, 122, 217, 0));
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
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(146, 169, 196, 0.16);
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: rgba(231, 238, 245, 0.8);
	}

	.user-message .message-actions span {
		background: rgba(255, 255, 255, 0.14);
		border-color: rgba(255, 255, 255, 0.16);
		color: rgba(255, 255, 255, 0.92);
	}

	.assistant-error {
		padding: 0 1.15rem;
		font-size: 0.82rem;
		font-weight: 700;
		color: #ffb9ab;
	}

	.assistant-composer {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: end;
		gap: 0.7rem;
		padding: 0.85rem 1rem 1rem;
		border-top: 1px solid rgba(146, 169, 196, 0.14);
	}

	.assistant-composer textarea {
		width: 100%;
		min-height: 3.15rem;
		max-height: 8rem;
		padding: 0.95rem 1rem;
		border-radius: 18px;
		border: 1px solid rgba(146, 169, 196, 0.14);
		background: rgba(255, 255, 255, 0.06);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
		font: inherit;
		color: rgba(246, 248, 251, 0.94);
		line-height: 1.45;
		resize: none;
	}

	.assistant-composer textarea::placeholder {
		color: rgba(220, 231, 242, 0.44);
	}

	.assistant-composer textarea:focus {
		outline: none;
		border-color: rgba(132, 186, 255, 0.34);
		box-shadow: 0 0 0 3px rgba(132, 186, 255, 0.12);
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
		background:
			radial-gradient(circle at top left, rgba(255, 255, 255, 0.22), transparent 40%),
			linear-gradient(135deg, #ff57c4, #73ecff 58%, #8a5bd1);
		box-shadow:
			0 16px 28px rgba(72, 95, 183, 0.28),
			0 0 22px rgba(255, 87, 196, 0.22);
		color: white;
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
</style>
