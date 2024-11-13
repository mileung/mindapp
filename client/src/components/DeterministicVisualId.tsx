import { createMemo } from 'solid-js';
import { Space } from '../utils/settings';

const DeterministicVisualId = (props: { class?: string; input?: Space | string }) => {
	const input = createMemo(() => {
		const { input = '' } = props;
		return typeof input === 'string' ? input : input?.host + (input?.owner?.id || '');
	});
	const aaa = createMemo(() => stringToNumber(input(), -35, -15));
	const bbb = createMemo(() => stringToNumber(input()?.slice(4), 20, 40));

	return (
		<div
			class={props.class}
			style={{
				'background-color': input() ? stringToColor(input()) : '#ccc',
			}}
		>
			{input() && (
				<div
					class="mt-[50%] ml-[50%] h-full w-full"
					style={{
						rotate: stringToAngle(input()),
						'transform-origin': 'top left',
						transform: `translateX(${aaa()}%) translateY(${aaa()}%)`,
					}}
				>
					<div
						class="h-[150%] w-[150%]"
						style={{ 'background-color': stringToColor(input().slice(3)) }}
					>
						<div
							class="h-[60%] w-[60%]"
							style={{
								'background-color': stringToColor(input().slice(6)),
								transform: `translateX(${bbb()}%) translateY(${bbb()}%)`,
							}}
						></div>
					</div>
				</div>
			)}
		</div>
	);
};

export default DeterministicVisualId;

// https://stackoverflow.com/a/21682946
const stringToColor = (string: string) => {
	let hash = 0;
	for (let i = 0; i < string.length; i++) {
		hash = string.charCodeAt(i) + ((hash << 3) - hash);
		hash = hash & hash;
	}
	const hue = hash % 360;
	const saturation = 81 + (hash % 20);
	const lightness = 55 + (hash % 20);
	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

const stringToAngle = (string: string) => {
	let hash = 0;
	for (let i = 0; i < string.length; i++) {
		hash = string.charCodeAt(i) + ((hash << 7) - hash);
		hash = hash & hash;
	}
	return `${hash % 360}deg`;
};

const stringToNumber = (string: string, min: number, max: number) => {
	let hash = 0;
	for (let i = 0; i < string.length; i++) {
		hash = string.charCodeAt(i) + ((hash << 3) - hash);
		hash = hash & hash;
	}
	return min + Math.abs(hash % (max - min + 1));
};
