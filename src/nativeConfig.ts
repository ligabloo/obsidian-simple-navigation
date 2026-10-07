import { App } from 'obsidian';

interface InternalPlugin {
	enabled?: boolean;
	instance?: { options?: Record<string, unknown> };
}

interface InternalPlugins {
	getPluginById?: (id: string) => InternalPlugin | undefined;
}

function internalPlugin(app: App, id: string): InternalPlugin | undefined {
	try {
		const plugins = (app as unknown as { internalPlugins?: InternalPlugins }).internalPlugins;
		return plugins?.getPluginById?.(id);
	} catch {
		return undefined;
	}
}

export function isCorePluginEnabled(app: App, id: string): boolean {
	return internalPlugin(app, id)?.enabled === true;
}

export interface DailyConfig {
	folder: string;
	format: string;
	template: string;
}

export type DailyStatus =
	| { state: 'disabled' }
	| { state: 'error' }
	| { state: 'ok'; config: DailyConfig };

/** Reads native core Daily Notes settings only (Periodic Notes is never consulted). */
export function readDailyConfig(app: App): DailyStatus {
	const plugin = internalPlugin(app, 'daily-notes');
	if (!plugin || plugin.enabled !== true) return { state: 'disabled' };
	try {
		const options = plugin.instance?.options;
		if (!options || typeof options !== 'object') return { state: 'error' };
		const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
		return {
			state: 'ok',
			config: {
				folder: str(options.folder),
				format: str(options.format) || 'YYYY-MM-DD',
				template: str(options.template),
			},
		};
	} catch {
		return { state: 'error' };
	}
}
