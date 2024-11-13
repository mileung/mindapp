import { createMemo } from 'solid-js';
import { Button } from './Button';

export function InputPicker(props: {
	title: string;
	options: [string, string][];
	value: () => string;
	onSubmit: (value: string) => void;
}) {
	const { title, options, value, onSubmit } = props;

	return (
		<div>
			<p class="leading-4 font-semibold">{title}</p>
			<div class="mt-1.5 fx gap-2">
				{options.map(([label, v]) => {
					return <Button on={() => value() === v} onClick={() => onSubmit(v)} label={label} />;
				})}
			</div>
		</div>
	);
}
