import { Accessor, createEffect } from 'solid-js';
import InputAutoWidth from './InputAutoWidth';

export function InputSetter(props: {
	title?: string;
	defaultValue: Accessor<string>;
	onSubmit: (value: string) => void;
}) {
	const { title, defaultValue, onSubmit } = props;
	let draft = defaultValue();
	let autoWidthIpt: undefined | HTMLInputElement;
	let keyDown = false;

	const updateSetting = () => {
		const value = autoWidthIpt!.value.trim();
		onSubmit(value);
	};

	createEffect(() => {
		autoWidthIpt!.value = defaultValue();
		draft = defaultValue();
	});

	return (
		<div>
			{title && <p class="leading-4 text font-semibold">{title}</p>}
			<InputAutoWidth
				ref={autoWidthIpt}
				value={defaultValue()}
				placeholder="Enter to submit"
				class="leading-3 min-w-52 border-b-2 text-2xl font-medium transition border-mg2 hover:border-fg2 focus:border-fg2"
				onKeyDown={(e) => {
					keyDown = true;
					if (e.key === 'Escape') {
						draft = defaultValue();
						autoWidthIpt?.blur();
					}
					if (e.key === 'Enter') {
						draft = autoWidthIpt!.value;
						updateSetting();
						autoWidthIpt?.blur();
					}
				}}
				onKeyUp={() => (keyDown = true)}
				onBlur={() => (autoWidthIpt!.value = draft)}
			/>
		</div>
	);
}
