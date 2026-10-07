import { App, moment, normalizePath, TFile } from 'obsidian';
import { DailyConfig } from './nativeConfig';
import { dailyRelativeName, expandTemplate, joinPath, normalizeFolder } from './logic';

export interface DailyEntry {
	file: TFile;
	date: number;
}

export function parseDailyDate(file: TFile, config: DailyConfig): number | null {
	const rel = dailyRelativeName(file.path, config.folder);
	if (rel === null) return null;
	const m = moment(rel, config.format, true);
	return m.isValid() ? m.valueOf() : null;
}

export function isDailyNote(file: TFile, config: DailyConfig | null): boolean {
	return config !== null && parseDailyDate(file, config) !== null;
}

export function listDailyNotes(app: App, config: DailyConfig): DailyEntry[] {
	const entries: DailyEntry[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		const date = parseDailyDate(file, config);
		if (date !== null) entries.push({ file, date });
	}
	return entries.sort((a, b) => b.date - a.date);
}

async function ensureFolder(app: App, folder: string): Promise<void> {
	const parts = normalizeFolder(folder).split('/').filter(Boolean);
	let current = '';
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
	}
}

async function readTemplate(app: App, template: string, title: string, now: moment.Moment): Promise<string> {
	if (!template) return '';
	const path = normalizePath(template);
	const file =
		app.metadataCache.getFirstLinkpathDest(path.replace(/\.md$/i, ''), '') ??
		app.vault.getAbstractFileByPath(path.endsWith('.md') ? path : `${path}.md`);
	if (!(file instanceof TFile)) return '';
	const raw = await app.vault.cachedRead(file);
	return expandTemplate(raw, title, (fmt) => now.format(fmt));
}

/** Returns today's daily note, creating it per native config if missing. */
export async function openOrCreateToday(app: App, config: DailyConfig): Promise<TFile> {
	const now = moment();
	const rel = now.format(config.format);
	const path = normalizePath(joinPath(config.folder, `${rel}.md`));
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;

	const slash = path.lastIndexOf('/');
	if (slash > 0) await ensureFolder(app, path.slice(0, slash));
	const title = path.slice(slash + 1).replace(/\.md$/i, '');
	return app.vault.create(path, await readTemplate(app, config.template, title, now));
}
