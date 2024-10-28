import { Button } from './Button';

export function InputPicker({
	title,
	options,
	value,
	onSubmit,
}: {
	title: string;
	options: string[];
	value: string;
	onSubmit: (value: string) => void;
}) {
	return (
		<div>
			<p className="leading-4 font-semibold">{title}</p>
			<div className="mt-1.5 fx gap-2">
				{options.map((option) => (
					<Button
						key={option}
						on={value === option}
						onClick={() => onSubmit(option)}
						label={option}
					/>
				))}
			</div>
		</div>
	);
}
