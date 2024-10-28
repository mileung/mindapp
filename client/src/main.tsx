import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import '@fontsource-variable/quicksand';
import '@fontsource-variable/fira-code';
import './styles/globals.css';
import './utils/theme.ts';

ReactDOM.createRoot(document.getElementById('root')!).render(
	//<React.StrictMode>
	<App />,
	//</React.StrictMode>
);
