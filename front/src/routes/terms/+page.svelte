<script>
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Terms &amp; Conditions</title>
	<meta
		name="description"
		content="Full Terms and Conditions for Task Monster, including the web app and Task Monster SMS Assistant."
	/>
</svelte:head>

<section class="legal-shell">
	<div class="legal-hero">
		<p class="eyebrow">Task Monster</p>
		<h1>Terms &amp; Conditions</h1>
		<p class="lede">
			These Terms &amp; Conditions govern the use of the Task Monster web app, related services, and
			the optional Task Monster SMS Assistant program.
		</p>
		<p class="meta">Last updated: April 24, 2026</p>
	</div>

	<div class="legal-card">
		<section id="acceptance">
			<h2>I. Acceptance of Terms</h2>
			<p>
				By accessing or using Task Monster, you agree to these Terms &amp; Conditions. If you do not
				agree, do not use the service.
			</p>
			<p>
				These terms apply to the Task Monster website, web app, related APIs, optional prerelease
				features, and the optional Task Monster SMS Assistant program.
			</p>
		</section>

		<section id="eligibility">
			<h2>II. Eligibility and Accounts</h2>
			<p>
				You are responsible for maintaining the confidentiality of your account credentials and for
				all activity that occurs under your account.
			</p>
			<p>
				You agree to provide accurate information when creating or maintaining an account and not to
				impersonate another person or create an account you are not authorized to use.
			</p>
			<p>
				If account creation is restricted by invite, alpha code, prerelease access, or similar
				controls, you agree not to bypass those restrictions.
			</p>
		</section>

		<section id="services">
			<h2>III. Description of Services</h2>
			<p>Task Monster is a task-management service that may include features such as:</p>
			<ul>
				<li>creating, editing, organizing, and archiving tasks</li>
				<li>moving tasks between inactive, daymap, active, and completed states</li>
				<li>tracking timed runs, tally-based runs, notes, and task history</li>
				<li>viewing statistics, logs, and derived productivity summaries</li>
				<li>using panic-mode or similar interruption-tracking features</li>
				<li>optionally interacting with the service through SMS</li>
			</ul>
			<p>
				Features may change over time, including the addition, removal, suspension, or replacement
				of workflows, data fields, or integrations.
			</p>
		</section>

		<section id="content-data">
			<h2>IV. User Content and Data</h2>
			<p>
				You retain responsibility for the content you submit to Task Monster, including task names,
				notes, instance notes, panic entries, linked phone numbers, and SMS prompts or replies.
			</p>
			<p>
				You represent that you have the right to submit that content and that it does not violate
				any law or the rights of others.
			</p>
			<p>
				You grant Task Monster a limited right to store, process, transmit, and display your data
				only as needed to operate the service, maintain security, provide support, and improve
				reliability.
			</p>
		</section>

		<section id="acceptable-use">
			<h2>V. Acceptable Use</h2>
			<p>You agree not to:</p>
			<ul>
				<li>attempt unauthorized access to accounts, systems, or data</li>
				<li>interfere with service performance or security</li>
				<li>use bots, scripts, or traffic patterns to abuse the service</li>
				<li>use Task Monster to harass, deceive, spam, or impersonate others</li>
				<li>send unlawful, harmful, or infringing content through the app or SMS program</li>
				<li>
					attempt to reverse engineer or circumvent service restrictions except where law permits
				</li>
			</ul>
		</section>

		<section id="sms">
			<h2>VI. Task Monster SMS Assistant Terms</h2>
			<p>
				The messaging program name is <strong>Task Monster SMS Assistant</strong>.
			</p>
			<p>
				Task Monster SMS Assistant allows verified users to interact with Task Monster by text
				message. Program messages may include account verification codes, task-action confirmations,
				task status replies, clarification prompts, help responses, support responses, and other
				service-related operational messages.
			</p>
			<p>
				You may use the SMS Assistant only after linking and verifying your phone number through the
				Task Monster interface.
			</p>
			<p>
				Message frequency varies based on your account activity, verification events, support
				requests, and the number of replies required to complete SMS-assisted actions.
			</p>
			<p>
				For help with the SMS program, reply <strong>HELP</strong> or contact
				<a href="mailto:support@task-monster.app">support@task-monster.app</a>.
			</p>
			<p>
				To opt out of the SMS program, reply <strong>STOP</strong>. After you send
				<strong>STOP</strong>, you should no longer receive SMS messages from the program unless you
				opt in again later.
			</p>
		</section>

		<section id="fees">
			<h2>VII. Fees, Carriers, and Messaging Limits</h2>
			<p>
				Message and data rates may apply depending on your wireless plan and carrier. Task Monster
				is not responsible for carrier fees, delivery delays, device issues, or message blocking by
				your carrier or handset.
			</p>
			<p>
				You are responsible for maintaining access to a phone number that can receive verification
				and service-related messages if you choose to use the SMS Assistant.
			</p>
		</section>

		<section id="availability">
			<h2>VIII. Availability, Changes, and Beta Features</h2>
			<p>
				Task Monster may include alpha, beta, experimental, or incomplete features. Those features
				may behave unexpectedly, may change without notice, and may be removed at any time.
			</p>
			<p>
				The service is provided on an as-available and as-offered basis. Uptime, message delivery,
				and uninterrupted access are not guaranteed.
			</p>
			<p>
				Task Monster may change the service, the terms, or any feature set at any time. Continued
				use after updates may be treated as acceptance of the revised terms.
			</p>
		</section>

		<section id="third-parties">
			<h2>IX. Third-Party Services</h2>
			<p>
				Task Monster may rely on third-party providers for hosting, databases, backups, messaging,
				analytics, AI-assisted interpretation, and related infrastructure.
			</p>
			<p>
				Third-party services operate under their own terms and policies. Task Monster is not
				responsible for interruptions, outages, or policy changes caused by those providers.
			</p>
		</section>

		<section id="ownership">
			<h2>X. Ownership and Intellectual Property</h2>
			<p>
				Task Monster and its software, branding, layouts, documentation, and service design remain
				the property of the service operator or its licensors, except for user-submitted content.
			</p>
			<p>
				These terms do not transfer ownership of the service or grant any license beyond the limited
				right to use the service in accordance with these terms.
			</p>
		</section>

		<section id="privacy">
			<h2>XI. Privacy</h2>
			<p>
				Your use of Task Monster is also governed by the <a href={resolve('/privacy')}
					>Privacy Policy</a
				>, which describes how information is collected, used, and handled, including information
				related to the SMS Assistant.
			</p>
		</section>

		<section id="termination">
			<h2>XII. Suspension and Termination</h2>
			<p>
				Task Monster may suspend, restrict, or terminate access to the service at any time if needed
				to protect the service, enforce these terms, respond to abuse, or comply with legal or
				operational requirements.
			</p>
			<p>
				You may stop using the service at any time. Opting out of SMS does not automatically delete
				your Task Monster account.
			</p>
		</section>

		<section id="disclaimers">
			<h2>XIII. Disclaimers</h2>
			<p>
				Task Monster is a productivity and task-management tool. It is not a medical service,
				emergency service, legal service, financial advisory service, or guaranteed reminder system.
			</p>
			<p>
				You remain responsible for how you use tasks, reminders, logs, statistics, and AI-assisted
				or SMS-assisted actions. Do not rely on the service for emergencies or time-critical safety
				functions.
			</p>
		</section>

		<section id="liability">
			<h2>XIV. Limitation of Liability</h2>
			<p>
				To the maximum extent permitted by law, Task Monster and its operators will not be liable
				for indirect, incidental, special, consequential, exemplary, or punitive damages, or for any
				loss of data, profits, goodwill, or business opportunities arising from or related to the
				service.
			</p>
			<p>
				To the extent permitted by law, the total liability of Task Monster and its operators for
				any claim arising out of or relating to the service will be limited to the amount you paid,
				if any, to use the service during the twelve months before the event giving rise to the
				claim.
			</p>
		</section>

		<section id="indemnification">
			<h2>XV. Indemnification</h2>
			<p>
				You agree to indemnify and hold harmless Task Monster and its operators from claims,
				liabilities, damages, losses, and reasonable expenses arising out of your misuse of the
				service, your content, your violation of these terms, or your violation of applicable law or
				the rights of another person.
			</p>
		</section>

		<section id="disputes">
			<h2>XVI. Governing Law and Disputes</h2>
			<p>
				These terms are intended to be enforced to the fullest extent permitted by applicable law.
				Any dispute relating to the service will be governed by the law that applies in the
				jurisdiction where the service operator is organized and administered, unless applicable law
				requires otherwise.
			</p>
			<p>
				If any part of these terms is found unenforceable, the remaining portions will remain in
				effect.
			</p>
		</section>

		<section id="contact">
			<h2>XVII. Contact</h2>
			<p>
				For questions about these terms, contact
				<a href="mailto:support@task-monster.app">support@task-monster.app</a>.
			</p>
		</section>
	</div>
</section>

<style>
	.legal-shell {
		display: grid;
		gap: 1.4rem;
		padding: 2rem 0 2.6rem;
	}

	.legal-hero {
		display: grid;
		gap: 0.75rem;
		max-width: 46rem;
	}

	.eyebrow {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 800;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--color-theme-2);
	}

	h1 {
		margin: 0;
		text-align: left;
		font-size: clamp(2.4rem, 5vw, 4rem);
		line-height: 0.95;
		letter-spacing: -0.05em;
		color: rgba(10, 20, 30, 0.92);
	}

	.lede {
		margin: 0;
		font-size: 1.05rem;
		color: rgba(10, 20, 30, 0.68);
		max-width: 42rem;
	}

	.meta {
		margin: 0;
		font-size: 0.88rem;
		color: rgba(10, 20, 30, 0.52);
		font-weight: 700;
	}

	.legal-card {
		border-radius: 28px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(245, 249, 255, 0.9)),
			radial-gradient(circle at top, rgba(64, 117, 166, 0.1), rgba(255, 255, 255, 0));
		border: 1px solid rgba(255, 255, 255, 0.78);
		box-shadow:
			0 26px 60px rgba(44, 62, 80, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.88);
	}

	.legal-card {
		display: grid;
		gap: 1.5rem;
		padding: 1.6rem;
	}

	section {
		display: grid;
		gap: 0.55rem;
		scroll-margin-top: 1.5rem;
	}

	h2 {
		margin: 0;
		font-size: 1.08rem;
		letter-spacing: -0.02em;
		color: rgba(10, 20, 30, 0.84);
	}

	p,
	li {
		font-size: 0.98rem;
		line-height: 1.6;
		color: rgba(10, 20, 30, 0.72);
	}

	p {
		margin: 0;
	}

	ul {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.35rem;
	}

	a {
		color: var(--color-theme-2);
		text-decoration: none;
		font-weight: 700;
	}

	a:hover {
		text-decoration: underline;
	}
</style>
