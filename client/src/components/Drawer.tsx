import { XMarkIcon } from '@heroicons/react/16/solid';
import React, { ReactNode, useEffect, useState } from 'react';

const width = 'w-[70%] max-w-lg md:min-w-80 md:w-[30%]';

const Drawer = ({
	isOpen,
	onClose,
	children,
}: {
	isOpen: boolean;
	onClose?: () => void;
	children: ReactNode;
}) => {
	const [showBackdrop, setShowBackdrop] = useState(false);
	const [backdropOpacity, setBackdropOpacity] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setShowBackdrop(true);
			// Small delay to ensure the backdrop is in the DOM before fading in
			setTimeout(() => setBackdropOpacity(true), 10);
		} else {
			setBackdropOpacity(false);
			// Wait for fade out animation before removing from DOM
			const timer = setTimeout(() => setShowBackdrop(false), 300);
			return () => clearTimeout(timer);
		}
	}, [isOpen]);

	return (
		<>
			{/* Backdrop */}
			{showBackdrop && (
				<div
					className={`block md:hidden fixed inset-0 bg-black z-50 transition-opacity duration-300 ease-in-out ${
						backdropOpacity ? 'opacity-50' : 'opacity-0'
					}`}
					onClick={onClose}
					aria-hidden="true"
				/>
			)}
			{/* Drawer */}
			<div
				className={`block md:hidden rounded-r fixed inset-y-0 left-0 z-50 bg-bg2 shadow-lg transform ${width} ${
					isOpen ? 'translate-x-0' : '-translate-x-full'
				} transition-transform duration-300 ease-in-out`}
			>
				{/* <button
					onClick={onClose}
					className="absolute right-0 z-50 h-8 w-8 xy transition text-fg2 hover:text-fg1 focus:text-fg1"
				>
					<XMarkIcon className="h-6 w-6" />
				</button> */}
				<div>{children}</div>
			</div>
		</>
	);
};

export default Drawer;

function toggleScroll(able: boolean) {
	const body = document.body;
	const scrollY = window.scrollY;
	if (able) {
		body.style.removeProperty('overflow');
		body.style.removeProperty('position');
		window.scrollTo(0, parseInt(body.style.top || '0') * -1);
		body.style.removeProperty('top');
		body.style.removeProperty('width');
	} else {
		body.style.overflow = 'hidden';
		body.style.position = 'fixed';
		body.style.top = `-${scrollY}px`;
		body.style.width = '100%';
	}
}
