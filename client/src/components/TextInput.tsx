import { CheckIcon, EyeIcon, EyeSlashIcon, XMarkIcon } from '@heroicons/react/16/solid';
import { useCallback, useMemo, useRef, useState } from 'react';
import InputAutoWidth from './InputAutoWidth';

export type TextInputRefObject = {
	tag: HTMLElement | null;
	readonly isValid: boolean;
	value: string;
	error: string;
};

export const useTextInputRef = () => {
	return useRef<TextInputRefObject>({
		tag: null,
		isValid: true,
		value: '',
		error: '',
	}).current;
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

export default function TextInput({
	_ref,
	containerClassName,
	autoFocus,
	numeric,
	password,
	defaultValue,
	maxDecimals = 0,
	disabled,
	label,
	placeholder = '',
	required,
	maxLength,
	getIssue = () => '',
	onKeyUp,
	onSubmit,
	showCheckX: _showCheckX,
}: {
	label: string;
	_ref?: TextInputRefObject;
	defaultValue?: string;
	containerClassName?: string;
	autoFocus?: boolean;
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
	const ipt = useRef<null | HTMLInputElement>(null);
	const eyeBtn = useRef<HTMLButtonElement>(null);
	const checkBtn = useRef<HTMLButtonElement>(null);
	const xBtn = useRef<HTMLButtonElement>(null);
	const [internalValue, internalValueSet] = useState(defaultValue || '');
	const [error, errorSet] = useState('');
	const [focused, focusedSet] = useState(false);
	const [passwordVisible, passwordVisibleSet] = useState(false);
	const id = useMemo(() => label.toLowerCase().replace(/\s+/g, '-'), [label]);
	const keyUp = useRef(true);

	const submit = useCallback(
		(value: string) => {
			if (!password) value = value.trim();
			onSubmit?.(value);
			internalValueSet(value);
			ipt.current!.blur();
		},
		[password, onSubmit],
	);

	const showCheckX = useMemo(
		() =>
			typeof _showCheckX === 'boolean'
				? _showCheckX
				: defaultValue !== undefined && defaultValue !== internalValue,
		[_showCheckX, defaultValue, internalValue],
	);

	const onEditingBlur = useCallback(() => {
		setTimeout(() => {
			if (
				![ipt.current, eyeBtn.current, checkBtn.current, xBtn.current].find(
					(e) => e === document.activeElement,
				)
			) {
				focusedSet(false);
			}
		}, 0);
	}, []);

	return (
		<div className={`w-fit relative ${error ? 'pb-0.5' : ''} ${containerClassName}`}>
			<label
				htmlFor={id}
				onMouseDown={() => setTimeout(() => ipt.current!.focus(), 0)}
				className="leading-4 font-semibold block transition"
			>
				{label}
				{!required && <span className="text-fg2"> (optional)</span>}
			</label>
			<div className="flex h-10">
				<InputAutoWidth
					id={id}
					placeholder={placeholder}
					disabled={disabled}
					autoFocus={autoFocus}
					autoComplete="off"
					className="leading-3 min-w-52 border-b-2 text-2xl font-medium transition border-mg2 hover:border-fg2 focus:border-fg2"
					type={password && !passwordVisible ? 'password' : 'text'}
					value={internalValue}
					onFocus={() => focusedSet(true)}
					onBlur={onEditingBlur}
					onKeyUp={() => (keyUp.current = true)}
					onKeyDown={(e) => {
						onKeyUp && onKeyUp(e.key);
						if (keyUp.current) {
							if (e.key === 'Escape') {
								internalValueSet(defaultValue || '');
								ipt.current?.blur();
							}
							if (e.key === 'Enter') submit(internalValue);
						}
						keyUp.current = false;
					}}
					onChange={({ target: { value } }) => {
						if (disabled) {
							return;
						}
						error && errorSet('');
						if (numeric && value) {
							// eslint-disable-next-line
							value = value.replace(/[^0123456789\.]/g, '');
							value = normalizeNumericInput(value, maxDecimals);
						}
						internalValueSet(maxLength ? value.slice(0, maxLength) : value);
					}}
					ref={(tag: HTMLInputElement | null) => {
						ipt.current = tag;
						if (_ref) {
							_ref.tag = tag;
							Object.defineProperty(_ref, 'error', {
								get: () => error,
								set: (v) => errorSet(v),
							});
							Object.defineProperty(_ref, 'value', {
								get: () => internalValue,
								set: internalValueSet,
							});
							Object.defineProperty(_ref, 'isValid', {
								get() {
									const { value } = ipt.current!;
									const trimmedValue = value.trim();
									if (required && !trimmedValue) {
										errorSet('This field cannot be blank');
										return false;
									} else if (trimmedValue && getIssue) {
										const newIssue = getIssue(trimmedValue) || '';
										errorSet(newIssue);
										return !newIssue;
									}
									return true;
								},
							});
						}
					}}
				/>
				{password && (
					<button
						ref={eyeBtn}
						className="w-8 xy transition text-fg2 hover:text-fg1"
						onBlur={onEditingBlur}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => {
							passwordVisibleSet(!passwordVisible);
							setTimeout(() => {
								// move cursor to end
								ipt.current!.setSelectionRange(internalValue.length, internalValue.length);
							}, 0);
						}}
					>
						{passwordVisible ? <EyeSlashIcon className="w-5" /> : <EyeIcon className="w-5" />}
					</button>
				)}
				{showCheckX && focused && (
					<>
						<button
							ref={checkBtn}
							className="w-8 xy transition text-fg2 hover:text-fg1"
							onBlur={onEditingBlur}
							onClick={() => submit(internalValue)}
						>
							<CheckIcon className="w-5" />
						</button>
						<button
							ref={xBtn}
							className="w-8 xy transition text-fg2 hover:text-fg1"
							onBlur={onEditingBlur}
							onClick={() => {
								internalValueSet(defaultValue || '');
								ipt.current?.blur();
							}}
						>
							<XMarkIcon className="w-5" />
						</button>
					</>
				)}
			</div>
			{error && <p className="mt-1 leading-3 font-bold text-red-500">{error}</p>}
		</div>
	);
}
