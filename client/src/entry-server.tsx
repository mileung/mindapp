// @refresh reload
import { createHandler, StartServer } from '@solidjs/start/server';
import { parseCookies } from 'vinxi/http';
import '@fontsource-variable/fira-code';
import '@fontsource-variable/quicksand';

export default createHandler(() => {
	const cookies = parseCookies();

	return (
		<StartServer
			document={({ assets, children, scripts }) => {
				return (
					<html lang="en" class={cookies.theme?.endsWith('dark') ? 'dark' : ''}>
						<head>
							<meta charset="utf-8" />
							<meta name="viewport" content="width=device-width, initial-scale=1" />
							<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
							<link rel="icon" href="/mindapp-logo.svg" />
							<link rel="manifest" href="/manifest.json" />
							{assets}
						</head>
						<body>
							<div id="app" class="">
								{children}
							</div>
							{scripts}
						</body>
					</html>
				);
			}}
		/>
	);
});
