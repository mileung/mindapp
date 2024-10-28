export function LabelVal({ label, value }: { label: string; value?: string }) {
	return (
		<div>
			<p className="text-xl font-semibold text-fg2 leading-5">{label}</p>
			<p className="text-xl font-medium break-all">{value}</p>
		</div>
	);
}
