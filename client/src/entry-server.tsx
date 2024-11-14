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
							<title>Mindapp</title>
							<meta name="description" content="cc = collective consciousness" />

							<link rel="manifest" href="/manifest.json" />
							<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
							<link rel="icon" href="/mindapp-logo.svg" />
							<meta property="og:url" content="https://mindapp.cc/" />
							<meta property="og:type" content="website" />
							<meta property="og:title" content="Mindapp" />
							<meta property="og:description" content="cc = collective consciousness" />
							<meta property="og:image" content="https://mindapp.cc/mindapp-og-bg.png" />
							<meta name="twitter:card" content="summary_large_image" />
							<meta property="twitter:domain" content="mindapp.cc" />
							<meta property="twitter:url" content="https://mindapp.cc/" />
							<meta name="twitter:title" content="Mindapp" />
							<meta name="twitter:description" content="cc = collective consciousness" />
							<meta name="twitter:image" content="https://mindapp.cc/mindapp-og-bg.png" />
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
