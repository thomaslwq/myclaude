// Node.js 18+ has globalThis.DOMException built in.
// This shim replaces the deprecated node-domexception package.
module.exports = globalThis.DOMException;
