export function LabelVal(props: { label: string; value?: string }) {
	const { label, value } = props;
	return (
		<div>
			<p class="text-xl font-semibold text-fg2 leading-5">{label}</p>
			<p class="text-xl font-medium break-all">{value}</p>
		</div>
	);
}
