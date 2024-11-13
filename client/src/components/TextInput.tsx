import { createEffect, createMemo, createSignal } from 'solid-js';
import InputAutoWidth from './InputAutoWidth';
import { Icon } from 'solid-heroicons';
import { check, eye, eyeSlash, xMark } from 'solid-heroicons/solid-mini';

export type TextInputRefObject = {
	tag: HTMLElement | null;
	readonly isValid: boolean;
	value: string;
	error: string;
};

const normalizeNumericInput = (str: string, decimals: number, removeInsignificantZeros = false) => {
	if (Number.isNaN(+str) || !str) {
		return '';
	}
	let firstDotIndex = str.indexOf('.');
	if (firstDotIndex === -1) {
		firstDotIndex = str.length;
	}
	str = str.slice(0, firstDotIndex + decimals + 1);
	if (removeInsignificantZeros) {
		str = +str + '';
	}
	return str;
};

export default function TextInput(props: {
	label: string;
	ref?: (t: HTMLInputElement) => void;
	defaultValue?: string;
	containerClass?: string;
	autofocus?: boolean;
	numeric?: boolean;
	password?: boolean;
	maxDecimals?: number;
	disabled?: boolean;
	onMetaEnter?: () => void;
	placeholder?: string;
	required?: boolean;
	maxLength?: number;
	getIssue?: (value: string) => string | void;
	onKeyUp?: (key: string) => void;
	onSubmit?: (value: string) => void;
	showCheckX?: boolean;
}) {
	const {
		ref,
		containerClass,
		autofocus,
		numeric,
		password,
		defaultValue,
		maxDecimals = 0,
		disabled,
		label,
		placeholder = '',
		required,
		maxLength,
		onKeyUp,
		onSubmit,
		showCheckX: _showCheckX,
	} = props;
	let ipt: undefined | HTMLInputElement;
	let eyeBtn: undefined | HTMLButtonElement;
	let checkBtn: undefined | HTMLButtonElement;
	let xBtn: undefined | HTMLButtonElement;
	const [internalValue, internalValueSet] = createSignal(defaultValue || '');
	const [error, errorSet] = createSignal('');
	const [focused, focusedSet] = createSignal(false);
	const [passwordVisible, passwordVisibleSet] = createSignal(false);
	const id = createMemo(() => label.toLowerCase().replace(/\s+/g, '-'));
	let keyUp = true;

	createEffect(() => {
		ipt && props.defaultValue && (ipt.value = props.defaultValue);
	});

	const submit = (value: string) => {
		if (!password) value = value.trim();
		onSubmit?.(value);
		internalValueSet(value);
		ipt!.blur();
	};

	const showCheckX = createMemo(() =>
		typeof _showCheckX === 'boolean'
			? _showCheckX
			: defaultValue !== undefined && defaultValue !== internalValue(),
	);

	const onEditingBlur = () => {
		setTimeout(() => {
			if (![ipt, eyeBtn, checkBtn, xBtn].find((e) => e === document.activeElement)) {
				focusedSet(false);
			}
		}, 0);
	};

	return (
		<div class={`w-fit relative ${error() ? 'pb-0.5' : ''} ${containerClass}`}>
			<label
				// htmlFor={id}
				onMouseDown={() => setTimeout(() => ipt!.focus(), 0)}
				class="leading-4 font-semibold block transition"
			>
				{label}
				{!required && <span class="text-fg2"> (optional)</span>}
			</label>
			<div class="flex h-10">
				<InputAutoWidth
					// id={id}
					placeholder={placeholder}
					disabled={disabled}
					autofocus={autofocus}
					autocomplete="off"
					class="leading-3 min-w-52 border-b-2 text-2xl font-medium transition border-mg2 hover:border-fg2 focus:border-fg2"
					type={password && !passwordVisible() ? 'password' : 'text'}
					// @ts-ignore
					defaultValue={props.defaultValue}
					onFocus={() => focusedSet(true)}
					onBlur={onEditingBlur}
					onKeyUp={() => (keyUp = true)}
					onKeyDown={(e) => {
						onKeyUp && onKeyUp(e.key);
						if (keyUp) {
							if (e.key === 'Escape') {
								internalValueSet(defaultValue || '');
								ipt?.blur();
							}
							if (e.key === 'Enter') submit(internalValue());
						}
						keyUp = false;
					}}
					onInput={({ target: { value } }) => {
						if (disabled) return;
						error() && errorSet('');
						if (numeric && value) {
							value = value.replace(/[^0123456789\.]/g, '');
							value = normalizeNumericInput(value, maxDecimals);
						}
						internalValueSet(maxLength ? value.slice(0, maxLength) : value);
					}}
					ref={(tag) => {
						ipt = tag;
						defaultValue && (tag.value = defaultValue);
						if (ref) ref(tag);
					}}
				/>
				{password && (
					<button
						ref={eyeBtn}
						class="w-8 xy transition text-fg2 hover:text-fg1"
						onBlur={onEditingBlur}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							passwordVisibleSet(!passwordVisible());
							setTimeout(() => {
								// move cursor to end
								ipt!.setSelectionRange(internalValue().length, internalValue().length);
							}, 0);
						}}
					>
						{passwordVisible() ? (
							<Icon path={eyeSlash} class="w-5" />
						) : (
							<Icon path={eye} class="w-5" />
						)}
					</button>
				)}
				{showCheckX() && focused() && (
					<>
						<button
							ref={checkBtn}
							class="w-8 xy transition text-fg2 hover:text-fg1"
							onBlur={onEditingBlur}
							onClick={() => submit(internalValue())}
						>
							<Icon path={check} class="w-5" />
						</button>
						<button
							ref={xBtn}
							class="w-8 xy transition text-fg2 hover:text-fg1"
							onBlur={onEditingBlur}
							onClick={() => {
								internalValueSet(defaultValue || '');
								ipt?.blur();
							}}
						>
							<Icon path={xMark} class="w-5" />
						</button>
					</>
				)}
			</div>
			{error() && <p class="mt-1 leading-3 font-bold text-red-500">{error()}</p>}
		</div>
	);
}
