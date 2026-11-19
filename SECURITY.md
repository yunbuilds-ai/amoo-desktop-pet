# Security

Please report suspected vulnerabilities through GitHub private vulnerability reporting once it is enabled. If it is unavailable, contact the maintainers privately for a reporting channel. Share a minimal reproduction and remove credentials and personal data.

The release build serves allowlisted local assets using an application-only scheme. The renderer is sandboxed with Node.js integration disabled. The preload exposes limited window operations. The application does not start a TCP service.
