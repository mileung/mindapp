document.addEventListener('keydown', (event) => {
	if (event.key === 'µ') {
		const selectedText = window.getSelection()?.toString().trim();
		alert(`Selected text: ${selectedText}`);
	}
});
