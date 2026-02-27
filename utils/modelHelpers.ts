/**
 * Utility functions for model sorting and filtering
 */

interface VersionInfo {
	hasDate?: boolean;
	date?: number;
	hasVersion?: boolean;
	version?: number;
	name: string;
}

/**
 * Extracts version information from a model name
 */
export function extractVersionInfo(name: string): VersionInfo {
	const dateMatch = name.match(/(\d{6})$/);
	if (dateMatch) {
		const dateStr = dateMatch[1];
		const year = 2000 + parseInt(dateStr.substring(0, 2));
		const month = parseInt(dateStr.substring(2, 4));
		const day = parseInt(dateStr.substring(4, 6));
		return {
			hasDate: true,
			date: new Date(year, month - 1, day).getTime(),
			name: name.replace(`-${dateStr}`, ''),
		};
	}

	const versionMatch = name.match(/v?(\d+)\.?(\d+)?/);
	if (versionMatch) {
		const major = parseInt(versionMatch[1]);
		const minor = parseInt(versionMatch[2] || '0');
		return {
			hasVersion: true,
			version: major * 1000 + minor,
			name: name.replace(versionMatch[0], ''),
		};
	}

	return { name };
}

/**
 * Gets tier priority for model sorting
 */
export function getTierPriority(name: string): number {
	if (name.includes('pro3')) return 5;
	if (name.includes('pro2') && !name.includes('pro3')) return 4;
	if (name.includes('pro') && !name.includes('pro2') && !name.includes('pro3')) return 3;
	if (name.includes('solar-1')) return 2;
	if (name.includes('mini')) return 1;
	return 0;
}

/**
 * Compares two model names for sorting (latest first)
 */
export function compareModelNames(a: string, b: string): number {
	const infoA = extractVersionInfo(a);
	const infoB = extractVersionInfo(b);

	if (infoA.hasDate && infoB.hasDate) {
		return infoB.date! - infoA.date!;
	}

	if (infoA.hasVersion && infoB.hasVersion) {
		return infoB.version! - infoA.version!;
	}

	if (
		(infoA.hasDate || infoA.hasVersion) &&
		!(infoB.hasDate || infoB.hasVersion)
	) {
		return -1;
	}
	if (
		(infoB.hasDate || infoB.hasVersion) &&
		!(infoA.hasDate || infoA.hasVersion)
	) {
		return 1;
	}

	if (infoA.name === infoB.name) {
		const priorityA = getTierPriority(a);
		const priorityB = getTierPriority(b);

		if (priorityA !== priorityB) {
			return priorityB - priorityA;
		}
	}

	return b.localeCompare(a);
}
