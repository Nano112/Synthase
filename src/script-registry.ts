// script-registry.ts
import { ScriptRegistry } from "./types.js";
export class InMemoryScriptRegistry implements ScriptRegistry {
	private scripts = new Map<string, string>();

	/**
	 * Register a script with content
	 */
	register(scriptId: string, content: string): void {
		this.scripts.set(scriptId, content);
		console.log(`📝 Registered script: ${scriptId}`);
	}

	/**
	 * Resolve script ID to content
	 */
	async resolve(scriptId: string): Promise<string> {
		const content = this.scripts.get(scriptId);
		if (!content) {
			throw new Error(`Script not found: ${scriptId}`);
		}
		console.log(`📖 Resolved script: ${scriptId}`);
		return content;
	}

	/**
	 * List all registered scripts
	 */
	list(): string[] {
		return Array.from(this.scripts.keys());
	}

	/**
	 * Check if script exists
	 */
	has(scriptId: string): boolean {
		return this.scripts.has(scriptId);
	}

	/**
	 * Remove a script
	 */
	unregister(scriptId: string): boolean {
		const deleted = this.scripts.delete(scriptId);
		if (deleted) {
			console.log(`🗑️ Unregistered script: ${scriptId}`);
		}
		return deleted;
	}

	/**
	 * Clear all scripts
	 */
	clear(): void {
		const count = this.scripts.size;
		this.scripts.clear();
		console.log(`🗑️ Cleared ${count} scripts from registry`);
	}
}

/**
 * HTTP-based script registry for loading from URLs
 */
export class HttpScriptRegistry implements ScriptRegistry {
	constructor(private baseUrl?: string) {}

	async resolve(scriptId: string): Promise<string> {
		// Handle absolute URLs
		if (scriptId.startsWith("http://") || scriptId.startsWith("https://")) {
			console.log(`🌐 Fetching script from URL: ${scriptId}`);
			const response = await fetch(scriptId);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch script: ${response.status} ${response.statusText}`
				);
			}
			return response.text();
		}

		// Handle relative URLs with base
		if (this.baseUrl) {
			const fullUrl = new URL(scriptId, this.baseUrl).toString();
			console.log(`🌐 Fetching script from: ${fullUrl}`);
			const response = await fetch(fullUrl);
			if (!response.ok) {
				throw new Error(
					`Failed to fetch script: ${response.status} ${response.statusText}`
				);
			}
			return response.text();
		}

		throw new Error(
			`Cannot resolve script: ${scriptId} (no base URL configured)`
		);
	}
}

/**
 * Composite registry that tries multiple sources in order
 */
export class CompositeScriptRegistry implements ScriptRegistry {
	constructor(private registries: ScriptRegistry[]) {}

	/**
	 * Add a registry to the end of the list
	 */
	addRegistry(registry: ScriptRegistry): void {
		this.registries.push(registry);
		console.log(
			`📚 Added registry to composite (total: ${this.registries.length})`
		);
	}

	/**
	 * Add a registry to the beginning of the list (higher priority)
	 */
	prependRegistry(registry: ScriptRegistry): void {
		this.registries.unshift(registry);
		console.log(
			`📚 Prepended registry to composite (total: ${this.registries.length})`
		);
	}

	async resolve(scriptId: string): Promise<string> {
		const errors: string[] = [];

		for (let i = 0; i < this.registries.length; i++) {
			const registry = this.registries[i];
			try {
				console.log(
					`🔍 Trying registry ${i + 1}/${
						this.registries.length
					} for: ${scriptId}`
				);
				const result = await registry.resolve(scriptId);
				console.log(`✅ Found script in registry ${i + 1}: ${scriptId}`);
				return result;
			} catch (error: any) {
				errors.push(`Registry ${i + 1}: ${error.message}`);
				console.log(
					`❌ Registry ${i + 1} failed for ${scriptId}: ${error.message}`
				);
				continue;
			}
		}

		throw new Error(
			`Script not found in any registry: ${scriptId}. Errors: ${errors.join(
				"; "
			)}`
		);
	}
}

/**
 * File system registry (Node.js only)
 */
export class FileSystemScriptRegistry implements ScriptRegistry {
	constructor(private scriptsDirectory: string) {}

	async resolve(scriptId: string): Promise<string> {
		try {
			// Dynamic import for Node.js modules
			const fs = await import("fs/promises");
			const path = await import("path");

			// Security: prevent directory traversal
			const sanitizedId = scriptId.replace(/[^a-zA-Z0-9\-_.]/g, "");
			if (sanitizedId !== scriptId) {
				throw new Error(`Invalid script ID: contains unsafe characters`);
			}

			const scriptPath = path.join(this.scriptsDirectory, sanitizedId);

			// Ensure the resolved path is within the scripts directory
			const resolvedPath = path.resolve(scriptPath);
			const resolvedDir = path.resolve(this.scriptsDirectory);

			if (!resolvedPath.startsWith(resolvedDir)) {
				throw new Error(`Invalid script path: outside scripts directory`);
			}

			console.log(`📁 Reading script from file: ${scriptPath}`);
			const content = await fs.readFile(scriptPath, "utf8");
			console.log(`✅ Loaded script from file: ${scriptId}`);
			return content;
		} catch (error: any) {
			if (error.code === "ENOENT") {
				throw new Error(`Script file not found: ${scriptId}`);
			}
			throw new Error(
				`Failed to read script file ${scriptId}: ${error.message}`
			);
		}
	}
}

/**
 * Cached registry wrapper - adds caching to any registry
 */
export class CachedScriptRegistry implements ScriptRegistry {
	private cache = new Map<string, { content: string; timestamp: number }>();
	private ttl: number;

	constructor(private baseRegistry: ScriptRegistry, ttlMinutes: number = 5) {
		this.ttl = ttlMinutes * 60 * 1000;
		console.log(`💾 Created cached registry with ${ttlMinutes}min TTL`);
	}

	async resolve(scriptId: string): Promise<string> {
		// Check cache first
		const cached = this.cache.get(scriptId);
		const now = Date.now();

		if (cached && now - cached.timestamp < this.ttl) {
			console.log(`📋 Using cached script: ${scriptId}`);
			return cached.content;
		}

		// Not in cache or expired - fetch from base registry
		console.log(`🔄 Fetching fresh script: ${scriptId}`);
		const content = await this.baseRegistry.resolve(scriptId);

		// Store in cache
		this.cache.set(scriptId, { content, timestamp: now });
		console.log(`💾 Cached script: ${scriptId}`);

		return content;
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		const count = this.cache.size;
		this.cache.clear();
		console.log(`🗑️ Cleared ${count} cached scripts`);
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats() {
		const entries = Array.from(this.cache.values());
		const now = Date.now();

		return {
			totalEntries: entries.length,
			avgAge:
				entries.length > 0
					? Math.round(
							entries.reduce((sum, e) => sum + (now - e.timestamp), 0) /
								entries.length /
								1000
					  )
					: 0,
			oldestEntry:
				entries.length > 0
					? Math.round(
							(now - Math.min(...entries.map((e) => e.timestamp))) / 1000
					  )
					: 0,
		};
	}

	/**
	 * Invalidate specific script
	 */
	invalidate(scriptId: string): boolean {
		const deleted = this.cache.delete(scriptId);
		if (deleted) {
			console.log(`🗑️ Invalidated cached script: ${scriptId}`);
		}
		return deleted;
	}
}

/**
 * GitHub script registry for loading from GitHub repositories
 */
export class GitHubScriptRegistry implements ScriptRegistry {
	constructor(
		private baseUrl: string = "https://raw.githubusercontent.com",
		private token?: string
	) {}

	async resolve(scriptId: string): Promise<string> {
		// Format: github:owner/repo/path/to/script.js[@branch]
		const githubMatch = scriptId.match(
			/^github:([^\/]+)\/([^\/]+)\/(.+?)(?:@(.+))?$/
		);

		if (!githubMatch) {
			throw new Error(
				`Invalid GitHub script format: ${scriptId}. Expected: github:owner/repo/path/to/script.js[@branch]`
			);
		}

		const [, owner, repo, path, branch = "main"] = githubMatch;
		const url = `${this.baseUrl}/${owner}/${repo}/${branch}/${path}`;

		const headers: Record<string, string> = {};
		if (this.token) {
			headers.Authorization = `token ${this.token}`;
		}

		console.log(`🐙 Fetching script from GitHub: ${url}`);

		const response = await fetch(url, { headers });
		if (!response.ok) {
			throw new Error(
				`GitHub fetch failed: ${response.status} ${response.statusText}`
			);
		}

		const content = await response.text();
		console.log(`✅ Loaded script from GitHub: ${scriptId}`);
		return content;
	}
}

/**
 * Environment-based registry - loads from different registries based on environment
 */
export class EnvironmentScriptRegistry implements ScriptRegistry {
	private registry: ScriptRegistry;

	constructor(
		private registries: {
			development?: ScriptRegistry;
			staging?: ScriptRegistry;
			production?: ScriptRegistry;
			default: ScriptRegistry;
		}
	) {
		const env = process.env.NODE_ENV || "development";
		this.registry =
			this.registries[env as keyof typeof this.registries] ||
			this.registries.default;

		console.log(`🌍 Environment registry initialized for: ${env}`);
	}

	async resolve(scriptId: string): Promise<string> {
		return this.registry.resolve(scriptId);
	}

	/**
	 * Switch environment
	 */
	switchEnvironment(env: string): void {
		const newRegistry =
			this.registries[env as keyof typeof this.registries] ||
			this.registries.default;
		this.registry = newRegistry;
		console.log(`🔄 Switched to ${env} environment registry`);
	}
}
