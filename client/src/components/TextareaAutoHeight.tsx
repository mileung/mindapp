import { useRef, TextareaHTMLAttributes, forwardRef } from 'react';

const resize = (node: HTMLTextAreaElement) => {
	setTimeout(() => {
		node.style.height = 'auto';
		node.style.height = node.scrollHeight + 'px';
	}, 0);
};

const TextareaAutoHeight = forwardRef(
	(props: TextareaHTMLAttributes<HTMLTextAreaElement>, parentRef) => {
		const internalRef = useRef<null | HTMLTextAreaElement>(null);
		const mounted = useRef(false);

		return (
			<textarea
				{...props}
				ref={(ref) => {
					if (mounted.current) return;
					mounted.current = true;
					ref && resize(ref);
					internalRef.current = ref;
					if (typeof parentRef === 'function') {
						parentRef(ref);
					} else {
						parentRef && (parentRef.current = ref);
					}
				}}
				// I'm cool with auto height just on mount
				onChange={(e) => {
					props.onChange?.(e);
					internalRef.current && resize(internalRef.current);
				}}
			/>
		);
	},
);

export default TextareaAutoHeight;
