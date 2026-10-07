export type RecencyGroup = 'Today' | 'This week' | 'Earlier';

export const UNTITLED = 'Sem título';
export const DAILY_PAGE_SIZE = 30;

export function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local calendar week starting Monday. */
export function startOfWeek(d: Date): Date {
	const day = startOfDay(d);
	const offset = (day.getDay() + 6) % 7;
	return new Date(day.getFullYear(), day.getMonth(), day.getDate() - offset);
}

export function recencyGroup(mtime: number, now: Date): RecencyGroup {
	if (mtime >= startOfDay(now).getTime()) return 'Today';
	if (mtime >= startOfWeek(now).getTime()) return 'This week';
	return 'Earlier';
}

export interface Group<T> {
	label: RecencyGroup;
	items: T[];
}

/** Sorts by mtime desc and groups; empty groups are omitted. */
export function groupByRecency<T extends { mtime: number }>(items: T[], now: Date): Group<T>[] {
	const sorted = [...items].sort((a, b) => b.mtime - a.mtime);
	const groups: Group<T>[] = [
		{ label: 'Today', items: [] },
		{ label: 'This week', items: [] },
		{ label: 'Earlier', items: [] },
	];
	for (const item of sorted) {
		const label = recencyGroup(item.mtime, now);
		groups.find((g) => g.label === label)?.items.push(item);
	}
	return groups.filter((g) => g.items.length > 0);
}

export function normalizeFolder(folder: string): string {
	return folder.replace(/^\/+|\/+$/g, '');
}

export function joinPath(folder: string, name: string): string {
	const f = normalizeFolder(folder);
	return f ? `${f}/${name}` : name;
}

export function parentFolder(path: string): string {
	const i = path.lastIndexOf('/');
	return i < 0 ? '' : path.slice(0, i);
}

/** Folder '' means the whole vault. Descendants are included. */
export function isInFolder(path: string, folder: string): boolean {
	const f = normalizeFolder(folder);
	return f === '' || path.startsWith(f + '/');
}

export function uniquePath(folder: string, base: string, ext: string, exists: (path: string) => boolean): string {
	let path = joinPath(folder, `${base}.${ext}`);
	for (let n = 1; exists(path); n++) {
		path = joinPath(folder, `${base} ${n}.${ext}`);
	}
	return path;
}

/**
 * Returns the date-format relative name of a file for daily-note recognition,
 * or null if the file is outside the configured folder.
 */
export function dailyRelativeName(path: string, folder: string): string | null {
	const f = normalizeFolder(folder);
	const noExt = path.replace(/\.md$/i, '');
	if (!path.toLowerCase().endsWith('.md')) return null;
	if (f === '') return noExt;
	return noExt.startsWith(f + '/') ? noExt.slice(f.length + 1) : null;
}

export function folderLabel(path: string): string {
	return parentFolder(path) || '/';
}

export function newBaseContent(folder: string): string {
	const f = normalizeFolder(folder);
	const filters = f
		? `filters:\n  and:\n    - file.inFolder(${JSON.stringify(f)})\n`
		: '';
	return `${filters}views:\n  - type: table\n    name: Table\n`;
}

export function expandTemplate(
	template: string,
	title: string,
	format: (fmt: string) => string,
): string {
	return template
		.replace(/{{\s*title\s*}}/gi, title)
		.replace(/{{\s*date\s*(?::([^}]+?))?\s*}}/gi, (_m, fmt: string | undefined) => format(fmt ?? 'YYYY-MM-DD'))
		.replace(/{{\s*time\s*(?::([^}]+?))?\s*}}/gi, (_m, fmt: string | undefined) => format(fmt ?? 'HH:mm'));
}
