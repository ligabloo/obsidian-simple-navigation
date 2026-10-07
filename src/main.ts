import { Plugin, WorkspaceLeaf } from 'obsidian';
import { SimpleNavigationView, VIEW_TYPE } from './view';

export default class SimpleNavigationPlugin extends Plugin {
	onload(): void {
		this.registerView(VIEW_TYPE, (leaf) => new SimpleNavigationView(leaf));
		this.addRibbonIcon('compass', 'Open simple navigation', () => {
			void this.activate();
		});
		this.addCommand({
			id: 'open',
			name: 'Open panel',
			callback: () => {
				void this.activate();
			},
		});
	}

	private async activate(): Promise<void> {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE)[0] ?? null;
		const existed = leaf !== null;
		if (!leaf) {
			leaf = workspace.getLeftLeaf(false);
			if (!leaf) return;
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}
		await workspace.revealLeaf(leaf);
		if (existed && leaf.view instanceof SimpleNavigationView) leaf.view.reset(true);
	}
}
