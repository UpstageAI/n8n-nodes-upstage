import { randomBytes } from 'crypto';

/**
 * Sanitize a string for use in multipart headers to prevent CRLF/header injection.
 * Removes CR, LF, and double-quote characters.
 */
function sanitizeHeaderValue(value: string): string {
	return value.replace(/[\r\n"]/g, '');
}

/**
 * Creates multipart/form-data body without external dependencies.
 * Uses crypto.randomBytes for secure boundary generation.
 */
export function createMultipartFormData(
	fields: Record<string, string>,
	file: { buffer: Buffer; filename: string; contentType: string }
): { body: Buffer; contentType: string } {
	const boundary =
		'----WebKitFormBoundary' + randomBytes(16).toString('hex');
	const parts: Buffer[] = [];

	// Add text fields
	for (const [name, value] of Object.entries(fields)) {
		const safeName = sanitizeHeaderValue(name);
		parts.push(
			Buffer.from(
				`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="${safeName}"\r\n\r\n` +
					`${value}\r\n`
			)
		);
	}

	// Add file
	const safeFilename = sanitizeHeaderValue(file.filename);
	const safeContentType = sanitizeHeaderValue(file.contentType);
	parts.push(
		Buffer.from(
			`--${boundary}\r\n` +
				`Content-Disposition: form-data; name="document"; filename="${safeFilename}"\r\n` +
				`Content-Type: ${safeContentType}\r\n\r\n`
		)
	);
	parts.push(file.buffer);
	parts.push(Buffer.from('\r\n'));

	// End boundary
	parts.push(Buffer.from(`--${boundary}--\r\n`));

	return {
		body: Buffer.concat(parts),
		contentType: `multipart/form-data; boundary=${boundary}`,
	};
}
