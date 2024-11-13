import { Icon } from 'solid-heroicons';
import { bars_3 } from 'solid-heroicons/solid-mini';
import { createEffect, createSignal, JSX } from 'solid-js';
import { hostedLocally } from '~/utils/api';
import { drawerOpen, drawerOpenSet, rootSettings } from '~/utils/state';

const Drawer = (props: {
	width?: string;
	hideWidth?: 'sm:hidden' | 'md:hidden';
	isOpen: () => boolean;
	onClose?: () => void;
	children: JSX.Element;
}) => {
	const {
		width = 'w-[70%] max-w-lg md:min-w-80 md:w-[30%]',
		hideWidth = 'md:hidden',
		isOpen,
		onClose,
		children,
	} = props;
	const [showBackdrop, setShowBackdrop] = createSignal(false);
	const [backdropOpacity, setBackdropOpacity] = createSignal(false);

	createEffect(() => {
		if (isOpen()) {
			setShowBackdrop(true);
			setTimeout(() => setBackdropOpacity(true), 10);
		} else {
			setBackdropOpacity(false);
			const timer = setTimeout(() => setShowBackdrop(false), 300);
			return () => clearTimeout(timer);
		}
	});

	return (
		<>
			{/* Backdrop */}
			{showBackdrop() && (
				<div
					class={`block fixed inset-0 bg-black z-50 transition-opacity duration-300 ease-in-out ${hideWidth} ${
						backdropOpacity() ? 'opacity-50' : 'opacity-0'
					}`}
					onClick={onClose}
					aria-hidden="true"
				/>
			)}
			<div
				class={`flex flex-col rounded-r fixed inset-y-0 left-0 z-50 bg-bg2 shadow-lg transform ${width} ${hideWidth} ${
					isOpen() ? 'translate-x-0' : '-translate-x-full'
				} transition-transform duration-300 ease-in-out`}
			>
				<div class="fx h-12">
					<button
						class="xy mr-2 h-full w-10 text-fg2 transition hover:text-fg1"
						onClick={() => drawerOpenSet(!drawerOpen())}
					>
						<Icon path={bars_3} class="h-7 w-7" />
					</button>
					<a href="/" class="fx shrink-0" onClick={() => drawerOpenSet(!drawerOpen())}>
						<img
							src={'/mindapp-logo.svg'}
							alt="logo"
							class={`h-6 ${hostedLocally && rootSettings.testWorkingDirectory && 'grayscale'}`}
						/>
						<p class="ml-2 text-xl font-black">Mindapp</p>
					</a>
				</div>
				<div class="flex-1">{children}</div>
			</div>
		</>
	);
};

export default Drawer;
