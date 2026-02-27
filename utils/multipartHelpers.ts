import { randomBytes } from 'crypto';

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
		parts.push(
			Buffer.from(
				`--${boundary}\r\n` +
					`Content-Disposition: form-data; name="${name}"\r\n\r\n` +
					`${value}\r\n`
			)
		);
	}

	// Add file
	parts.push(
		Buffer.from(
			`--${boundary}\r\n` +
				`Content-Disposition: form-data; name="document"; filename="${file.filename}"\r\n` +
				`Content-Type: ${file.contentType}\r\n\r\n`
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
