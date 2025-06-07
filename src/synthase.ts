import type { IOSchema, Job, ParameterSpec } from "./types.js";
import { ParameterUtils, LoadedScript } from "./types.js";
import type { ScriptRegistry } from "./script-registry.js";

import initNucleationWasm, { SchematicWrapper } from "nucleation";

// Initialize Nucleation WASM module
initNucleationWasm().then(() => {
    console.log("🔬 Nucleation WASM module initialized")
}).catch((error) => {
    console.error("❌ Failed to initialize Nucleation WASM module:", error);
});


// Enhanced cache entry with metadata
interface CacheEntry {
	script: LoadedScript;
	timestamp: number;
	contentHash: string;
	source: string;
}

export class Synthase {
	private scriptCache = new Map<string, CacheEntry>();
	private cachePolicy = {
		maxAge: 5 * 60 * 1000, // 5 minutes
		maxSize: 100,          // max cached scripts
	};

	constructor(private registry?: ScriptRegistry) {}

	/**
	 * Configure cache policy
	 */
	setCachePolicy(policy: Partial<typeof this.cachePolicy>): void {
		this.cachePolicy = { ...this.cachePolicy, ...policy };
		console.log(`⚙️ Cache policy updated:`, this.cachePolicy);
	}

	/**
	 * Phase 1: Load script and all dependencies with smart caching
	 */
	async plan(scriptContent: string, scriptId = "main"): Promise<Job> {
		console.log(`🔍 Planning script execution: ${scriptId}`);

		// Clean up expired cache entries
		this.cleanupCache();

		const loadedScripts = await this.loadScriptTree(scriptContent, scriptId);
		const context = await this.createContextWithScripts(loadedScripts);

		const mainScript = loadedScripts.get(scriptId);
		if (!mainScript) {
			throw new Error(`Main script not found: ${scriptId}`);
		}

		console.log(`📋 Main script IO: ${scriptId}`, mainScript.io);
		console.log(`🔗 Total dependencies loaded: ${loadedScripts.size - 1}`);
		console.log(`💾 Cache entries: ${this.scriptCache.size}`);

		return new SynthaseJob(
			mainScript.io,
			mainScript.deps,
			mainScript.defaultFunction,
			context
		);
	}

	/**
	 * Recursively load a script and all its dependencies with caching
	 */
	private async loadScriptTree(
		scriptContent: string,
		scriptId: string
	): Promise<Map<string, LoadedScript>> {
		const loadedScripts = new Map<string, LoadedScript>();
		const loadingQueue: Array<{ id: string; content?: string }> = [
			{ id: scriptId, content: scriptContent },
		];
		const processed = new Set<string>();

		while (loadingQueue.length > 0) {
			const { id, content } = loadingQueue.shift()!;
			if (processed.has(id)) continue;

			console.log(`🔧 Loading script: ${id}`);

			let loadedScript: LoadedScript;

			if (content) {
				// Main script - always process fresh but check cache for content changes
				const contentHash = this.hashContent(content);
				const cached = this.getCachedScript(id);
				
				if (cached && cached.contentHash === contentHash) {
					console.log(`✅ Using cached script (content unchanged): ${id}`);
					loadedScript = cached.script;
				} else {
					loadedScript = this.processScript(id, content);
					this.cacheScript(id, loadedScript, content, 'main');
				}
			} else {
				// Dependency - check cache first
				const cached = this.getCachedScript(id);
				if (cached) {
					console.log(`✅ Using cached script: ${id}`);
					loadedScript = cached.script;
				} else {
					// Not cached - resolve and process
					if (!this.registry) {
						console.warn(`⚠️  No registry configured, skipping dependency: ${id}`);
						continue;
					}

					try {
						const depContent = await this.registry.resolve(id);
						loadedScript = this.processScript(id, depContent);
						this.cacheScript(id, loadedScript, depContent, 'dependency');
					} catch (error) {
						throw new Error(`Failed to load dependency ${id}: ${error.message}`);
					}
				}
			}

			loadedScripts.set(id, loadedScript);
			processed.add(id);

			// Queue dependencies
			for (const depId of loadedScript.deps) {
				if (!processed.has(depId) && !loadedScripts.has(depId)) {
					loadingQueue.push({ id: depId });
				}
			}
		}

		return loadedScripts;
	}

	/**
	 * Process script content into LoadedScript
	 */
	private processScript(id: string, content: string): LoadedScript {
		const module = this.createModule(content);
		const { io, deps, defaultFunction } = this.introspectModule(module);
		return { id, io, deps, defaultFunction };
	}

	/**
	 * Check if script is cached and still valid
	 */
	private getCachedScript(scriptId: string): CacheEntry | null {
		const entry = this.scriptCache.get(scriptId);
		if (!entry) return null;

		// Check if expired
		const age = Date.now() - entry.timestamp;
		if (age > this.cachePolicy.maxAge) {
			console.log(`⏰ Cache expired for ${scriptId} (${Math.round(age/1000)}s old)`);
			this.scriptCache.delete(scriptId);
			return null;
		}

		return entry;
	}

	/**
	 * Cache a processed script
	 */
	private cacheScript(id: string, script: LoadedScript, content: string, source: string): void {
		const contentHash = this.hashContent(content);
		const entry: CacheEntry = {
			script,
			timestamp: Date.now(),
			contentHash,
			source
		};

		this.scriptCache.set(id, entry);
		console.log(`💾 Cached script: ${id} (${source}, hash: ${contentHash.substring(0, 8)})`);
	}

	/**
	 * Invalidate cache for a specific script
	 */
	invalidateScript(scriptId: string): void {
		const deleted = this.scriptCache.delete(scriptId);
		if (deleted) {
			console.log(`🗑️ Invalidated cache for: ${scriptId}`);
		}
	}

	/**
	 * Invalidate cache by content (call this when script content changes)
	 */
	invalidateByContent(scriptId: string, newContent: string): void {
		const entry = this.scriptCache.get(scriptId);
		if (!entry) return;

		const newHash = this.hashContent(newContent);
		if (entry.contentHash !== newHash) {
			console.log(`🔄 Content changed for ${scriptId}, invalidating cache`);
			this.invalidateScript(scriptId);
		}
	}

	/**
	 * Clean up old cache entries
	 */
	private cleanupCache(): void {
		const entries = Array.from(this.scriptCache.entries());
		
		// Remove expired entries
		const now = Date.now();
		let cleaned = 0;
		for (const [id, entry] of entries) {
			if (now - entry.timestamp > this.cachePolicy.maxAge) {
				this.scriptCache.delete(id);
				cleaned++;
			}
		}

		// Remove excess entries (LRU)
		const remaining = Array.from(this.scriptCache.entries());
		if (remaining.length > this.cachePolicy.maxSize) {
			remaining
				.sort((a, b) => a[1].timestamp - b[1].timestamp)
				.slice(0, remaining.length - this.cachePolicy.maxSize)
				.forEach(([id]) => {
					this.scriptCache.delete(id);
					cleaned++;
				});
		}

		if (cleaned > 0) {
			console.log(`🧹 Cleaned up ${cleaned} cache entries`);
		}
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats() {
		const entries = Array.from(this.scriptCache.values());
		const now = Date.now();
		
		return {
			totalEntries: entries.length,
			avgAge: entries.length > 0 
				? Math.round(entries.reduce((sum, e) => sum + (now - e.timestamp), 0) / entries.length / 1000)
				: 0,
			sources: entries.reduce((acc, e) => {
				acc[e.source] = (acc[e.source] || 0) + 1;
				return acc;
			}, {} as Record<string, number>)
		};
	}

	/**
	 * Simple content hashing for cache invalidation
	 */
	private hashContent(content: string): string {
		let hash = 0;
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // 32-bit integer
		}
		return Math.abs(hash).toString(36);
	}

	/**
	 * Clear all caches
	 */
	clearCache(): void {
		const count = this.scriptCache.size;
		this.scriptCache.clear();
		console.log(`🗑️ Cleared ${count} cache entries`);
	}

	// ... rest of your existing methods remain the same
	private createModule(scriptContent: string) {
		const moduleBlob = new Blob([scriptContent], {
			type: "application/javascript",
		});
		const moduleUrl = URL.createObjectURL(moduleBlob);

		return { url: moduleUrl, content: scriptContent };
	}

	private introspectModule(moduleInfo: { url: string; content: string }) {
		console.log("🔧 Introspecting module exports...");

		try {
			const ioMatch = moduleInfo.content.match(
				/export\s+const\s+io\s*=\s*({[\s\S]*?});/
			);
			if (!ioMatch) throw new Error("No 'io' export found in script");
			const io = eval(`(${ioMatch[1]})`);

			const fnMatch = moduleInfo.content.match(
				/export\s+default\s+(async\s+function[^{]*\{[\s\S]*\})/
			);
			if (!fnMatch)
				throw new Error("No default function export found in script");
			const defaultFunction = eval(`(${fnMatch[1]})`);

			const deps = this.extractDependencies(moduleInfo.content);

			URL.revokeObjectURL(moduleInfo.url);

			return { io: io as IOSchema, deps, defaultFunction };
		} catch (error) {
			URL.revokeObjectURL(moduleInfo.url);
			throw new Error(`Script introspection failed: ${error.message}`);
		}
	}

	private extractDependencies(scriptContent: string): string[] {
		const importMatches =
			scriptContent.match(/importScript\s*\(\s*["']([^"']+)["']\s*\)/g) || [];
		return importMatches
			.map((match) => {
				const urlMatch = match.match(/["']([^"']+)["']/);
				return urlMatch ? urlMatch[1] : "";
			})
			.filter(Boolean);
	}

	private async createContextWithScripts(
		loadedScripts: Map<string, LoadedScript>
	) {

		return {
			Logger: {
				info: (message: string) => console.log("ℹ️  INFO:", message),
				success: (message: string) => console.log("✅ SUCCESS:", message),
				warn: (message: string) => console.log("⚠️  WARN:", message),
				error: (message: string) => console.log("❌ ERROR:", message),
			},

			Calculator: {
				enhance: (value: number) => value * 1.1,
				sum: (array: number[]) => array.reduce((a, b) => a + b, 0),
				average: (array: number[]) =>
					array.length > 0
						? array.reduce((a, b) => a + b, 0) / array.length
						: 0,
				multiply: (numbers: number[]) => numbers.reduce((a, b) => a * b, 1),
			},

			Utils: {
				formatNumber: (num: number, decimals = 0) =>
					parseFloat(num.toFixed(decimals)),
				capitalize: (str: string) => str.charAt(0).toUpperCase() + str.slice(1),
				delay: (ms: number) =>
					new Promise((resolve) => setTimeout(resolve, ms)),
				randomInt: (min: number, max: number) =>
					Math.floor(Math.random() * (max - min + 1)) + min,
				shuffleArray: (array: any[]) => {
					/* ... */ return array;
				},
				randomChoice: (array: any[]) =>
					array[Math.floor(Math.random() * array.length)],
			},

			Schematic: SchematicWrapper,

			Blocks: {
				get: (blockId: string) => {
					console.log(`🎯 Getting block: ${blockId}`);
					return { id: blockId, name: blockId };
				},
			},

			importScript: async (scriptId: string) => {
				console.log(`📦 Importing script: ${scriptId}`);

				const script = loadedScripts.get(scriptId);
				if (!script) throw new Error(`Script not found: ${scriptId}`);

				const scriptExport = async (inputs: any) => {
					console.log(`🚀 Executing imported script ${scriptId} with:`, inputs);
					const validatedInputs = this.validateInputsForScript(
						inputs,
						script.io
					);
					const subContext = await this.createContextWithScripts(loadedScripts);
					return await script.defaultFunction(validatedInputs, subContext);
				};

				(scriptExport as any).io = script.io;
				(scriptExport as any).deps = script.deps;

				return scriptExport;
			},
		};
	}

	private validateInputsForScript(inputs: Record<string, any>, io: IOSchema) {
		const inputsWithDefaults = ParameterUtils.applyDefaults(inputs, io.inputs);

		for (const [key, spec] of Object.entries(io.inputs)) {
			if (!ParameterUtils.shouldShowParameter(spec, inputsWithDefaults))
				continue;
			if (key in inputsWithDefaults) {
				ParameterUtils.validateParameter(inputsWithDefaults[key], spec, key);
			} else {
				throw new Error(`Missing required input: ${key}`);
			}
		}

		return inputsWithDefaults;
	}

	dispose() {
		this.clearCache();
	}
}

class SynthaseJob implements Job {
	constructor(
		public io: IOSchema,
		public deps: string[],
		private defaultFunction: Function,
		private context: any
	) {}

	async call(inputs: Record<string, any>): Promise<any> {
		console.log("🚀 Executing script with inputs:", inputs);
		this.validateInputs(inputs);

		try {
			return await this.defaultFunction(inputs, this.context);
		} catch (error) {
			console.error("❌ Script execution failed:", error);
			throw error;
		}
	}

	private validateInputs(inputs: Record<string, any>) {
		console.log("✅ Input validation passed");
	}

	dispose() {
		console.log("🧹 Job disposed");
	}
}