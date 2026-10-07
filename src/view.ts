import { debounce, ItemView, Menu, Notice, setIcon, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { DailyEntry, isDailyNote, listDailyNotes, openOrCreateToday } from './dailyNotes';
import {
	DAILY_PAGE_SIZE,
	folderLabel,
	groupByRecency,
	isInFolder,
	joinPath,
	newBaseContent,
	normalizeFolder,
	parentFolder,
	uniquePath,
	UNTITLED,
} from './logic';
import { DailyConfig, isCorePluginEnabled, readDailyConfig } from './nativeConfig';

interface AppCommands {
	findCommand(id: string): unknown;
	executeCommandById(id: string): boolean;
}

export const VIEW_TYPE = 'simple-navigation-view';

type TabId = 'daily' | 'common' | 'bases';

const TABS: { id: TabId; label: string; icon: string }[] = [
	{ id: 'daily', label: 'Daily notes', icon: 'calendar' },
	{ id: 'common', label: 'Notes', icon: 'files' },
	{ id: 'bases', label: 'Bases', icon: 'layout-list' },
];

export class SimpleNavigationView extends ItemView {
	private tab: TabId = 'daily';
	private folder = '';
	private dailyCount = DAILY_PAGE_SIZE;
	private daily: DailyConfig | null = null;
	private available: TabId[] = [];
	private readonly refresh = debounce(() => this.render(), 300, true);

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Simple navigation';
	}

	getIcon(): string {
		return 'compass';
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass('simple-navigation');
		const { vault } = this.app;
		this.registerEvent(vault.on('create', () => this.refresh()));
		this.registerEvent(vault.on('delete', () => this.refresh()));
		this.registerEvent(vault.on('rename', () => this.refresh()));
		this.registerEvent(vault.on('modify', () => this.refresh()));
		this.reset(true);
		await Promise.resolve();
	}

	/** Resets transient state; the notice is shown only when the panel is opened. */
	reset(notify: boolean): void {
		this.folder = '';
		this.dailyCount = DAILY_PAGE_SIZE;
		this.computeAvailability(notify);
		this.tab = this.available[0] ?? 'common';
		this.render();
	}

	private computeAvailability(notify: boolean): void {
		const status = readDailyConfig(this.app);
		this.daily = status.state === 'ok' ? status.config : null;
		if (status.state === 'error' && notify) {
			new Notice('Simple navigation: could not read the daily notes settings, so that tab is hidden.');
		}
		this.available = [];
		if (this.daily) this.available.push('daily');
		this.available.push('common');
		if (isCorePluginEnabled(this.app, 'bases')) this.available.push('bases');
	}

	private render(): void {
		this.computeAvailability(false);
		if (!this.available.includes(this.tab)) this.tab = this.available[0] ?? 'common';
		const el = this.contentEl;
		el.empty();

		const header = el.createDiv({ cls: 'simple-nav-header' });
		const tabs = header.createDiv({ cls: 'simple-nav-tabs' });
		for (const t of TABS.filter((t) => this.available.includes(t.id))) {
			const btn = tabs.createDiv({
				cls: 'clickable-icon simple-nav-tab' + (t.id === this.tab ? ' is-active' : ''),
				attr: { 'aria-label': t.label, role: 'tab' },
			});
			setIcon(btn, t.icon);
			btn.addEventListener('click', () => {
				this.tab = t.id;
				this.render();
			});
		}
		const actions = header.createDiv({ cls: 'simple-nav-actions' });
		this.renderActions(actions);

		if (this.tab !== 'daily') this.renderBreadcrumb(el);
		const list = el.createDiv({ cls: 'simple-nav-list' });
		if (this.tab === 'daily') this.renderDaily(list);
		else if (this.tab === 'common') this.renderCommon(list);
		else this.renderBases(list);
	}

	private action(parent: HTMLElement, icon: string, label: string, fn: () => void | Promise<void>): void {
		const btn = parent.createDiv({ cls: 'clickable-icon', attr: { 'aria-label': label } });
		setIcon(btn, icon);
		btn.addEventListener('click', () => {
			Promise.resolve(fn()).catch((e: unknown) => {
				new Notice(`Simple navigation: ${e instanceof Error ? e.message : String(e)}`);
			});
		});
	}

	private renderActions(parent: HTMLElement): void {
		if (this.tab === 'daily' && this.daily) {
			const config = this.daily;
			this.action(parent, 'calendar-plus', "Open today's note", async () => {
				await this.openFile(await openOrCreateToday(this.app, config));
			});
		} else if (this.tab === 'common') {
			this.action(parent, 'file-plus', 'New note', () => this.createFile('md', ''));
			this.action(parent, 'layout-dashboard', 'New canvas', () => this.createFile('canvas', '{}'));
		} else if (this.tab === 'bases') {
			this.action(parent, 'plus', 'New base', () => this.createBase());
		}
	}

	private async openFile(file: TFile): Promise<void> {
		await this.app.workspace.getLeaf(false).openFile(file);
	}

	private async createFile(ext: 'md' | 'canvas', content: string): Promise<void> {
		const { vault } = this.app;
		const path = uniquePath(this.folder, UNTITLED, ext, (p) => vault.getAbstractFileByPath(p) !== null);
		await this.openFile(await vault.create(path, content));
	}

	private baseDestination(): string {
		if (this.folder) return this.folder;
		const active = this.app.workspace.getActiveFile();
		return active ? parentFolder(active.path) : '';
	}

	private async createBase(): Promise<void> {
		const { vault, workspace } = this.app;
		const commands = (this.app as unknown as { commands: AppCommands }).commands;
		const dest = normalizeFolder(this.baseDestination());
		const activeFolder = parentFolder(workspace.getActiveFile()?.path ?? '');

		// The native command's destination is undocumented; only try it when it would
		// plausibly create next to the active file, and verify the result.
		const nativeId = 'bases:create-new';
		if (!this.folder && dest === activeFolder && commands.findCommand(nativeId)) {
			const created = await new Promise<TFile | null>((resolve) => {
				const ref = vault.on('create', (f) => {
					if (f instanceof TFile && f.extension === 'base') done(f);
				});
				const timer = window.setTimeout(() => done(null), 800);
				const done = (f: TFile | null) => {
					window.clearTimeout(timer);
					vault.offref(ref);
					resolve(f);
				};
				commands.executeCommandById(nativeId);
			});
			if (created && parentFolder(created.path) === dest) return;
		}

		const path = uniquePath(dest, UNTITLED, 'base', (p) => vault.getAbstractFileByPath(p) !== null);
		await this.openFile(await vault.create(path, newBaseContent(dest)));
	}

	private renderBreadcrumb(parent: HTMLElement): void {
		const bar = parent.createDiv({ cls: 'simple-nav-breadcrumb' });
		const crumb = (label: string, target: string) => {
			const c = bar.createSpan({ cls: 'simple-nav-crumb', text: label });
			c.addEventListener('click', () => {
				this.folder = target;
				this.render();
			});
		};
		crumb('All', '');
		let acc = '';
		for (const part of this.folder.split('/').filter(Boolean)) {
			acc = joinPath(acc, part);
			bar.createSpan({ cls: 'simple-nav-sep', text: '/' });
			crumb(part, acc);
		}
		const pick = bar.createDiv({ cls: 'clickable-icon simple-nav-pick', attr: { 'aria-label': 'Choose folder' } });
		setIcon(pick, 'folder');
		pick.addEventListener('click', (evt) => {
			const menu = new Menu();
			menu.addItem((i) => i.setTitle('All').setChecked(this.folder === '').onClick(() => this.setFolder('')));
			const folders = this.app.vault
				.getAllLoadedFiles()
				.filter((f): f is TFolder => f instanceof TFolder && !f.isRoot())
				.map((f) => f.path)
				.sort((a, b) => a.localeCompare(b));
			for (const path of folders) {
				menu.addItem((i) => i.setTitle(path).setChecked(this.folder === path).onClick(() => this.setFolder(path)));
			}
			menu.showAtMouseEvent(evt);
		});
	}

	private setFolder(path: string): void {
		this.folder = path;
		this.render();
	}

	private item(parent: HTMLElement, file: TFile, title: string, showFolder: boolean): void {
		const row = parent.createDiv({ cls: 'tree-item-self is-clickable simple-nav-item' });
		row.createDiv({ cls: 'tree-item-inner', text: title });
		if (showFolder) row.createDiv({ cls: 'simple-nav-folder', text: folderLabel(file.path) });
		if (this.app.workspace.getActiveFile()?.path === file.path) row.addClass('is-active');
		row.addEventListener('click', () => {
			this.openFile(file).catch((e: unknown) => new Notice(String(e)));
		});
	}

	private empty(parent: HTMLElement): void {
		parent.createDiv({ cls: 'pane-empty', text: 'Nothing here yet.' });
	}

	private renderDaily(parent: HTMLElement): void {
		if (!this.daily) return;
		const all: DailyEntry[] = listDailyNotes(this.app, this.daily);
		if (all.length === 0) return this.empty(parent);
		for (const e of all.slice(0, this.dailyCount)) this.item(parent, e.file, e.file.basename, false);
		if (all.length > this.dailyCount) {
			const more = parent.createEl('button', { cls: 'simple-nav-more', text: 'Load more' });
			more.addEventListener('click', () => {
				this.dailyCount += DAILY_PAGE_SIZE;
				this.render();
			});
		}
	}

	private renderCommon(parent: HTMLElement): void {
		const files = this.app.vault
			.getFiles()
			.filter((f) => f.extension === 'md' || f.extension === 'canvas')
			.filter((f) => isInFolder(f.path, this.folder) && !isDailyNote(f, this.daily));
		const groups = groupByRecency(files.map((file) => ({ file, mtime: file.stat.mtime })), new Date());
		if (groups.length === 0) return this.empty(parent);
		for (const g of groups) {
			parent.createDiv({ cls: 'simple-nav-group', text: g.label });
			for (const { file } of g.items) this.item(parent, file, file.basename, true);
		}
	}

	private renderBases(parent: HTMLElement): void {
		const files = this.app.vault
			.getFiles()
			.filter((f) => f.extension === 'base' && isInFolder(f.path, this.folder))
			.sort((a, b) => a.basename.localeCompare(b.basename));
		if (files.length === 0) return this.empty(parent);
		for (const file of files) this.item(parent, file, file.basename, true);
	}
}
