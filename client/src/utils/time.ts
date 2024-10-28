import dayjs from 'dayjs';

export const second = 1000;
export const minute = 60 * second;
export const hour = 60 * minute;
export const day = 24 * hour;
export const week = 7 * day;
export const month = 30 * day;
export const year = 365 * day;

export function formatTimestamp(timestamp: number, ago = true): string {
	if (ago) {
		const now = dayjs();
		const timeDiff = now.diff(timestamp);
		if (timeDiff < minute) {
			return '<1m';
		} else if (timeDiff < hour) {
			const minutesAgo = Math.floor(timeDiff / minute);
			return `${minutesAgo}m`;
		} else if (timeDiff < day) {
			const hoursAgo = Math.floor(timeDiff / hour);
			return `${hoursAgo}h`;
		} else if (timeDiff <= week) {
			const daysAgo = Math.floor(timeDiff / day);
			return `${daysAgo}d`;
		}
	}
	return dayjs(timestamp).format('YYYY-MM-DD HH:mm');
}
