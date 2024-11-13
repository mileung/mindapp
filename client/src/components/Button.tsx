import { A } from '@solidjs/router';
import { createMemo } from 'solid-js';

export function Button(props: {
	on?: () => boolean;
	href?: string;
	onClick?: any;
	label: string;
	state?: any;
}) {
	const { on, href, onClick = () => {}, label } = props;

	const className = createMemo(() => {
		return `block w-fit text-lg font-semibold rounded px-2 border-2 transition hover:text-fg1 hover:border-fg1 ${
			on?.() ? 'text-fg1 border-fg1' : 'text-fg2 border-fg2'
		}`;
	});

	return href ? (
		<A class={className()} {...{ href, onClick }}>
			{label}
		</A>
	) : (
		<button class={className()} onClick={onClick}>
			{label}
		</button>
	);
}
