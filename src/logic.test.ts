import { describe, expect, it } from 'vitest';
import {
	dailyRelativeName, expandTemplate, groupByRecency, isInFolder, newBaseContent, recencyGroup, startOfWeek, uniquePath,
} from './logic';

// Wednesday 2026-10-07 12:00 local
const now = new Date(2026, 9, 7, 12);

describe('recency', () => {
	it('week starts on Monday', () => {
		expect(startOfWeek(now)).toEqual(new Date(2026, 9, 5));
		expect(startOfWeek(new Date(2026, 9, 11, 9))).toEqual(new Date(2026, 9, 5));
	});
	it('groups today, this week and earlier', () => {
		expect(recencyGroup(new Date(2026, 9, 7, 1).getTime(), now)).toBe('Today');
		expect(recencyGroup(new Date(2026, 9, 5, 0, 1).getTime(), now)).toBe('This week');
		expect(recencyGroup(new Date(2026, 9, 4, 23).getTime(), now)).toBe('Earlier');
	});
	it('sorts by mtime desc and omits empty groups', () => {
		const a = { mtime: new Date(2026, 9, 1).getTime() };
		const b = { mtime: new Date(2026, 9, 7, 2).getTime() };
		const groups = groupByRecency([a, b], now);
		expect(groups.map((g) => g.label)).toEqual(['Today', 'Earlier']);
	});
});

describe('paths', () => {
	it('filters including descendants only', () => {
		expect(isInFolder('a/b/c.md', 'a')).toBe(true);
		expect(isInFolder('ab/c.md', 'a')).toBe(false);
		expect(isInFolder('x.md', '')).toBe(true);
	});
	it('adds numeric suffix on collision', () => {
		const taken = new Set(['Sem título.md', 'Sem título 1.md']);
		expect(uniquePath('', 'Sem título', 'md', (p) => taken.has(p))).toBe('Sem título 2.md');
		expect(uniquePath('f', 'Sem título', 'md', (p) => taken.has(p))).toBe('f/Sem título.md');
	});
	it('daily relative name respects folder', () => {
		expect(dailyRelativeName('Daily/2026-10-07.md', 'Daily')).toBe('2026-10-07');
		expect(dailyRelativeName('Other/2026-10-07.md', 'Daily')).toBeNull();
		expect(dailyRelativeName('2026/10/07.md', '')).toBe('2026/10/07');
		expect(dailyRelativeName('Daily/x.canvas', 'Daily')).toBeNull();
	});
});

describe('base and template', () => {
	it('builds base content with folder filter', () => {
		expect(newBaseContent('a/b')).toContain('file.inFolder("a/b")');
		expect(newBaseContent('')).not.toContain('filters');
		expect(newBaseContent('')).toContain('type: table');
	});
	it('expands template variables', () => {
		const out = expandTemplate('# {{title}} {{date:DD}} {{time}}', 'T', (f) => `<${f}>`);
		expect(out).toBe('# T <DD> <HH:mm>');
	});
});
