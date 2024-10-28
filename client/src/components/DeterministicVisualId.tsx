import { useMemo } from 'react';
import { Space } from '../utils/settings';

const DeterministicVisualId = ({
	className,
	input = '',
}: {
	className?: string;
	input?: Space | string;
}) => {
	input = typeof input === 'string' ? input : input?.host + (input.owner?.id || '');
	const inputExists = useMemo(() => !!input, [input]);
	const aaa = useMemo(() => stringToNumber(input, -35, -15), [input]);
	const bbb = useMemo(() => stringToNumber(input.slice(4), 20, 40), [input]);

	return (
		<div
			className={className}
			style={{
				backgroundColor: inputExists ? stringToColor(input) : '#ccc',
			}}
		>
			{inputExists && (
				<div
					className="mt-[50%] ml-[50%] h-full w-full"
					style={{
						rotate: stringToAngle(input),
						transformOrigin: 'top left',
						transform: `translateX(${aaa}%) translateY(${aaa}%)`,
					}}
				>
					<div
						className="h-[150%] w-[150%]"
						style={{ backgroundColor: stringToColor(input.slice(3)) }}
					>
						<div
							className="h-[60%] w-[60%]"
							style={{
								backgroundColor: stringToColor(input.slice(6)),
								transform: `translateX(${bbb}%) translateY(${bbb}%)`,
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
