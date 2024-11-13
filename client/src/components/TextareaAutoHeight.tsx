import { JSX } from 'solid-js';

const resize = (node: HTMLTextAreaElement) => {
	setTimeout(() => {
		node.style.height = 'auto';
		node.style.height = node.scrollHeight + 'px';
	}, 0);
};

const TextareaAutoHeight = (
	props: JSX.TextareaHTMLAttributes<HTMLTextAreaElement> & { defaultValue: string },
) => {
	let internalRef: undefined | HTMLTextAreaElement;
	let mounted = false;

	return (
		<textarea
			{...props}
			ref={(ref) => {
				if (mounted) return;
				mounted = true;
				ref && resize(ref);
				internalRef = ref;
				ref.value = props.defaultValue || '';
				setTimeout(() => ref.focus(), 0); // Not sure why I need this to autofocus but I do
			}}
			// I'm cool with auto height just on mount
			onInput={(e) => {
				// @ts-ignore
				props.onChange?.(e);
				internalRef && resize(internalRef);
			}}
		/>
	);
};
export default TextareaAutoHeight;
