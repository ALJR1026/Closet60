// Minimal multipart/form-data parser (no external dependencies).
// Handles simple, single-level forms: text fields + optional file fields.

function parseMultipart(buffer, boundary) {
  const result = { fields: {}, files: {} };
  const boundaryBuf = Buffer.from(`--${boundary}`);
  let start = buffer.indexOf(boundaryBuf);
  if (start === -1) return result;
  start += boundaryBuf.length;

  while (true) {
    if (buffer.slice(start, start + 2).toString('latin1') === '--') break; // final boundary
    start += 2; // skip CRLF after boundary marker
    const nextBoundary = buffer.indexOf(boundaryBuf, start);
    if (nextBoundary === -1) break;
    const part = buffer.slice(start, nextBoundary - 2); // strip trailing CRLF before next boundary
    parsePart(part, result);
    start = nextBoundary + boundaryBuf.length;
  }
  return result;
}

function parsePart(part, result) {
  const headerEnd = part.indexOf('\r\n\r\n');
  if (headerEnd === -1) return;
  const headerStr = part.slice(0, headerEnd).toString('utf8');
  const body = part.slice(headerEnd + 4);

  const nameMatch = headerStr.match(/name="([^"]*)"/);
  if (!nameMatch) return;
  const name = nameMatch[1];

  const filenameMatch = headerStr.match(/filename="([^"]*)"/);
  if (filenameMatch && filenameMatch[1]) {
    const typeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
    result.files[name] = {
      filename: filenameMatch[1],
      mimetype: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
      buffer: body
    };
  } else {
    result.fields[name] = body.toString('utf8');
  }
}

module.exports = { parseMultipart };
