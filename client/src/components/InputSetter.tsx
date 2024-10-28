import { useCallback, useEffect, useRef } from 'react';
import InputAutoWidth from './InputAutoWidth';

export function InputSetter({
	title,
	defaultValue,
	onSubmit,
}: {
	title?: string;
	defaultValue: string;
	onSubmit: (value: string) => void;
}) {
	const draft = useRef(defaultValue);
	const autoWidthIpt = useRef<HTMLInputElement>(null);
	const keyDown = useRef(false);

	const updateSetting = useCallback(() => {
		const value = autoWidthIpt.current!.value.trim();
		onSubmit(value);
	}, [onSubmit]);

	useEffect(() => {
		autoWidthIpt.current!.value = defaultValue;
		draft.current = defaultValue;
	}, [defaultValue]);

	return (
		<div>
			{title && <p className="leading-4 text font-semibold">{title}</p>}
			<InputAutoWidth
				ref={autoWidthIpt}
				defaultValue={defaultValue}
				placeholder="Enter to submit"
				className="leading-3 min-w-52 border-b-2 text-2xl font-medium transition border-mg2 hover:border-fg2 focus:border-fg2"
				onKeyDown={(e) => {
					keyDown.current = true;
					if (e.key === 'Escape') {
						draft.current = defaultValue;
						autoWidthIpt.current?.blur();
					}
					if (e.key === 'Enter') {
						draft.current = autoWidthIpt.current!.value;
						updateSetting();
						autoWidthIpt.current?.blur();
					}
				}}
				onKeyUp={() => (keyDown.current = true)}
				onBlur={() => (autoWidthIpt.current!.value = draft.current)}
			/>
		</div>
	);
}
