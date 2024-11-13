import { Title } from '@solidjs/meta';
import { HttpStatusCode } from '@solidjs/start';

export default function NotFound() {
	return (
		<div>
			<Title>Page Not Found | Mindapp</Title>
			<HttpStatusCode code={404} />
			<div class="xy h-32">
				<p class="text-2xl font-medium">Page Not Found</p>
			</div>
		</div>
	);
}
