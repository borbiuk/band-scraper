import { Source } from './logger';

export const onlyUnique = <T>(value: T, index: number, array: T[]): boolean => array.indexOf(value) === index
export const isNullOrUndefined = (x: unknown): boolean => x === null || x === undefined;
export const isEmptyString = (x: string): boolean => isNullOrUndefined(x) || x === '';
export const isAlbum = (url: string): boolean => isValidUrl(url) && url.includes('/album/');
export const isTrack = (url: string): boolean => isValidUrl(url) && url.includes('/track/');
export const isTrackOrAlbum = (url: string): boolean => isValidUrl(url) && (url.includes('/album/') || url.includes('/track/'));
export const originalUrl = (url: string): string => url.split('?')[0];
export const isValidUrl = (urlString: string): boolean => {
	if (isEmptyString(urlString)) {
		return false;
	}

	try {
		return Boolean(new URL(urlString));
	} catch (e) {
		return false;
	}
}

export const waitOn = async (condition: () => boolean, timeout: number): Promise<boolean> => {
	const start: number = Date.now();

	while (Date.now() - start < timeout) {
		if (condition()) {
			return true;
		}
		await new Promise(resolve => setTimeout(resolve, 1_000));
	}

	return false;
}

export const logMessage = (source: Source, message: string, url?: string): string => {
	return isEmptyString(url)
		? `\t${source} ▶ ${message}; ⏺ ⏺ ⏺`
		: `\t${source} ▶ ${message} > 🔗 ${url}; ⏺ ⏺ ⏺`;
}
