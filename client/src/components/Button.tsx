import { useMemo } from 'react';
import { Link } from 'react-router-dom';

export function Button({
	on,
	to,
	onClick = () => {},
	label,
	state,
}: {
	on?: boolean;
	to?: string;
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
	label: string;
	state?: any;
}) {
	const Tag = useMemo(() => (to ? Link : 'button'), []);
	return (
		// @ts-ignore
		<Tag
			className={`block w-fit text-lg font-semibold rounded px-2 border-2 transition hover:text-fg1 ${on ? 'text-fg1 border-fg1' : 'text-fg2 border-fg2'}`}
			{...{ to, onClick, state }}
		>
			{label}
		</Tag>
	);
}
