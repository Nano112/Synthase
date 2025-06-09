// synthase.ts
import type {
	IOSchema,
	LoadedScript,
	CacheEntry,
	ScriptContentResolver,
	ImportedScript,
	SynthaseConfig,
} from "./types";
import { ParameterUtils } from "./types";
import { ExecutionLimits } from "./execution-limits";
import { ScriptValidator } from "./script-validator";
import { ResourceMonitor } from "./resource-monitor";

export class Synthase {
	private scriptCache = new Map<string, CacheEntry>();
	private cachePolicy = {
		maxAge: 5 * 60 * 1000, // 5 minutes
		maxSize: 100, // max cached scripts
	};

	private loadedScript: LoadedScript | null = null;
	private isInitialized = false;
	private initializationPromise: Promise<void> | null = null;
	private executionLimits = new ExecutionLimits();
	private scriptValidator = new ScriptValidator();
	private resourceMonitor = new ResourceMonitor();

	constructor(
		private scriptContentOrResolver: string | ScriptContentResolver,
		private config?: SynthaseConfig
	) {
		// Apply configuration
		if (config?.limits) {
			this.executionLimits = new ExecutionLimits(config.limits);
		}
		if (config?.resourceMonitor) {
			this.resourceMonitor = new ResourceMonitor(config.resourceMonitor);
		}

		// Start initialization immediately but don't block constructor
		this.initializationPromise = this.initialize();
	}

	/**
	 * Configure cache policy
	 */
	setCachePolicy(policy: Partial<typeof this.cachePolicy>): void {
		this.cachePolicy = { ...this.cachePolicy, ...policy };
		console.log(`⚙️ Cache policy updated:`, this.cachePolicy);
	}

	/**
	 * Wait for initialization to complete
	 */
	async waitForInitialization(): Promise<void> {
		if (!this.isInitialized) {
			if (!this.initializationPromise) {
				throw new Error("Synthase initialization failed");
			}
			await this.initializationPromise;
		}
	}

	/**
	 * Initialize and plan the main script
	 */
	private async initialize(): Promise<void> {
		try {
			console.log(`🔍 Initializing Synthase...`);

			// Clean up expired cache entries
			this.cleanupCache();

			// Resolve script content
			let scriptContent: string;
			if (typeof this.scriptContentOrResolver === "string") {
				scriptContent = this.scriptContentOrResolver;
			} else {
				console.log(`🔄 Resolving script content via callback`);
				scriptContent = await this.scriptContentOrResolver();
			}

			// Validate script before planning
			const validation = this.scriptValidator.validateScript(scriptContent);
			if (!validation.valid) {
				throw new Error(
					`Script validation failed: ${validation.errors.join(", ")}`
				);
			}

			// Plan the main script
			const scriptId = `main-${Date.now()}-${Math.random()
				.toString(36)
				.substr(2, 9)}`;
			this.loadedScript = await this.loadScriptTree(scriptContent, scriptId);

			console.log(`📋 Main script planned: ${scriptId}`);
			console.log(
				`🔗 Total dependencies loaded: ${this.loadedScript.deps.length}`
			);
			console.log(`💾 Cache entries: ${this.scriptCache.size}`);

			this.isInitialized = true;
		} catch (error: any) {
			console.error(`❌ Synthase initialization failed:`, error);
			throw error;
		}
	}

	/**
	 * Execute the script with given inputs
	 */
	async call(inputs: Record<string, any>): Promise<any> {
		// Wait for initialization if not complete
		await this.waitForInitialization();

		if (!this.loadedScript) {
			throw new Error("No script loaded");
		}

		console.log("🚀 Executing script with inputs:", inputs);

		// Start resource monitoring
		this.resourceMonitor.start();

		try {
			// Validate inputs
			const validatedInputs = this.validateInputs(inputs, this.loadedScript.io);

			// Create execution context
			const context = await this.createExecutionContext();

			// Execute with timeout and resource monitoring
			const result = await this.executionLimits.executeWithTimeout(
				() => this.loadedScript!.defaultFunction(validatedInputs, context),
				this.executionLimits.timeout
			);

			console.log("✅ Script executed successfully");
			return result;
		} catch (error: any) {
			console.error("❌ Script execution failed:", error);
			throw error;
		} finally {
			this.resourceMonitor.stop();
		}
	}

	/**
	 * Get the IO schema of the loaded script
	 */
	getIO(): IOSchema | null {
		return this.loadedScript?.io || null;
	}

	/**
	 * Get dependencies of the loaded script
	 */
	getDependencies(): string[] {
		return this.loadedScript?.deps || [];
	}

	/**
	 * Reload the script (for hot reloading)
	 */
	async reload(): Promise<void> {
		console.log("🔄 Reloading script...");
		this.isInitialized = false;
		this.loadedScript = null;
		this.clearCache(); // Clear cache to force fresh load
		this.initializationPromise = this.initialize();
		await this.initializationPromise;
	}

	/**
	 * Load script and all dependencies
	 */
	private async loadScriptTree(
		scriptContent: string,
		scriptId: string
	): Promise<LoadedScript> {
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
					this.cacheScript(id, loadedScript, content, "main");
				}
			} else {
				// Dependency - check cache first
				const cached = this.getCachedScript(id);
				if (cached) {
					console.log(`✅ Using cached script: ${id}`);
					loadedScript = cached.script;
				} else {
					// Not cached - resolve and process
					if (!this.config?.registry) {
						console.warn(
							`⚠️  No registry configured, skipping dependency: ${id}`
						);
						continue;
					}

					try {
						const depContent = await this.config.registry.resolve(id);

						// Validate dependency
						const validation = this.scriptValidator.validateScript(depContent);
						if (!validation.valid) {
							throw new Error(
								`Dependency validation failed: ${validation.errors.join(", ")}`
							);
						}

						loadedScript = this.processScript(id, depContent);
						this.cacheScript(id, loadedScript, depContent, "dependency");
					} catch (error: any) {
						throw new Error(
							`Failed to load dependency ${id}: ${error.message}`
						);
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

		const mainScript = loadedScripts.get(scriptId);
		if (!mainScript) {
			throw new Error(`Main script not found: ${scriptId}`);
		}

		return mainScript;
	}

	/**
	 * Create execution context with injectable dependencies
	 */
	private async createExecutionContext(): Promise<any> {
		// Track imports for this execution
		const importTracker = {
			importCount: 0,
			importStack: [] as string[],
			importedScripts: new Set<string>(),
		};

		// Base context - always available
		const baseContext = {
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
					const result = [...array];
					for (let i = result.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[result[i], result[j]] = [result[j], result[i]];
					}
					return result;
				},
				randomChoice: (array: any[]) =>
					array[Math.floor(Math.random() * array.length)],
			},

			// Enhanced importScript with safety checks
			importScript: async (
				contentOrResolver: string | ScriptContentResolver
			): Promise<ImportedScript> => {
				console.log(
					`📦 Importing script (${importTracker.importCount + 1}/${
						this.executionLimits.maxImportedScripts
					})`
				);

				// Check import limits
				if (
					importTracker.importCount >= this.executionLimits.maxImportedScripts
				) {
					throw new Error(
						`Import limit exceeded: maximum ${this.executionLimits.maxImportedScripts} scripts per execution`
					);
				}

				// Check recursion depth
				if (
					importTracker.importStack.length >=
					this.executionLimits.maxRecursionDepth
				) {
					throw new Error(
						`Recursion depth limit exceeded: maximum ${this.executionLimits.maxRecursionDepth} levels`
					);
				}

				// Check resource usage
				this.resourceMonitor.check();

				let scriptContent: string;
				const scriptId = `imported-${Date.now()}-${Math.random()
					.toString(36)
					.substr(2, 9)}`;

				if (typeof contentOrResolver === "string") {
					scriptContent = contentOrResolver;
				} else {
					try {
						scriptContent = await contentOrResolver();
					} catch (error: any) {
						throw new Error(
							`Failed to resolve script content: ${error.message}`
						);
					}
				}

				// Check for recursive imports by content hash
				const contentHash = this.hashContent(scriptContent);
				if (importTracker.importedScripts.has(contentHash)) {
					throw new Error(
						`Recursive import detected: script content already imported in this execution`
					);
				}

				// Validate imported script
				const validation = this.scriptValidator.validateScript(scriptContent);
				if (!validation.valid) {
					throw new Error(
						`Imported script validation failed: ${validation.errors.join(", ")}`
					);
				}

				// Track this import
				importTracker.importCount++;
				importTracker.importStack.push(scriptId);
				importTracker.importedScripts.add(contentHash);

				try {
					// Process the script
					const loadedScript = this.processScript(scriptId, scriptContent);

					// Create callable function that shares this context
					const importedScript = async (
						inputs: Record<string, any>
					): Promise<any> => {
						console.log(
							`🚀 Executing imported script ${scriptId} with:`,
							inputs
						);

						// Validate inputs for this script
						const validatedInputs = this.validateInputs(
							inputs,
							loadedScript.io
						);

						// Execute with same context (shared Logger, Calculator, etc.)
						const context = await this.createExecutionContext();
						return await loadedScript.defaultFunction(validatedInputs, context);
					};

					// Attach metadata
					(importedScript as any).io = loadedScript.io;
					(importedScript as any).deps = loadedScript.deps;
					(importedScript as any).id = scriptId;

					console.log(`✅ Script imported successfully: ${scriptId}`);
					return importedScript as ImportedScript;
				} finally {
					// Clean up tracking
					importTracker.importStack.pop();
				}
			},
		};

		// Merge base context with injected context providers
		const context = {
			...baseContext,
			...(this.config?.contextProviders || {}), // Inject custom dependencies
		};

		return context;
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
	 * Validate inputs against IO schema
	 */
	private validateInputs(
		inputs: Record<string, any>,
		io: IOSchema
	): Record<string, any> {
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

	/**
	 * Check if script is cached and still valid
	 */
	private getCachedScript(scriptId: string): CacheEntry | null {
		const entry = this.scriptCache.get(scriptId);
		if (!entry) return null;

		// Check if expired
		const age = Date.now() - entry.timestamp;
		if (age > this.cachePolicy.maxAge) {
			console.log(
				`⏰ Cache expired for ${scriptId} (${Math.round(age / 1000)}s old)`
			);
			this.scriptCache.delete(scriptId);
			return null;
		}

		return entry;
	}

	/**
	 * Cache a processed script
	 */
	private cacheScript(
		id: string,
		script: LoadedScript,
		content: string,
		source: string
	): void {
		const contentHash = this.hashContent(content);
		const entry: CacheEntry = {
			script,
			timestamp: Date.now(),
			contentHash,
			source,
		};

		this.scriptCache.set(id, entry);
		console.log(
			`💾 Cached script: ${id} (${source}, hash: ${contentHash.substring(
				0,
				8
			)})`
		);
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
			avgAge:
				entries.length > 0
					? Math.round(
							entries.reduce((sum, e) => sum + (now - e.timestamp), 0) /
								entries.length /
								1000
					  )
					: 0,
			sources: entries.reduce((acc, e) => {
				acc[e.source] = (acc[e.source] || 0) + 1;
				return acc;
			}, {} as Record<string, number>),
		};
	}

	/**
	 * Simple content hashing for cache invalidation
	 */
	private hashContent(content: string): string {
		let hash = 0;
		for (let i = 0; i < content.length; i++) {
			const char = content.charCodeAt(i);
			hash = (hash << 5) - hash + char;
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

	/**
	 * Create module from script content
	 */
	private createModule(scriptContent: string) {
		const moduleBlob = new Blob([scriptContent], {
			type: "application/javascript",
		});
		const moduleUrl = URL.createObjectURL(moduleBlob);

		return { url: moduleUrl, content: scriptContent };
	}

	/**
	 * Introspect module to extract IO, dependencies, and default function
	 */
	private introspectModule(moduleInfo: { url: string; content: string }) {
		console.log("🔧 Introspecting module exports...");

		try {
			// More robust regex to match the io export - handles multiline objects better
			const ioMatch = moduleInfo.content.match(
				/export\s+const\s+io\s*=\s*(\{[\s\S]*?\});/
			);
			let ioText = ioMatch ? ioMatch[1] : null;

			// Try alternative format without trailing semicolon if first attempt fails
			if (!ioText) {
				const altMatch = moduleInfo.content.match(
					/export\s+const\s+io\s*=\s*(\{[\s\S]*?\})/
				);
				ioText = altMatch ? altMatch[1] : null;
			}

			if (!ioText) throw new Error("No 'io' export found in script");

			const io = eval(`(${ioText})`);

			// More flexible regex for default function - handles various formats
			let fnMatch = moduleInfo.content.match(
				/export\s+default\s+(async\s+function[^{]*\{[\s\S]*\})/
			);

			// Try arrow function format if regular function doesn't match
			if (!fnMatch) {
				fnMatch = moduleInfo.content.match(
					/export\s+default\s+(async\s*\([^)]*\)\s*=>\s*\{[\s\S]*\})/
				);
			}

			if (!fnMatch)
				throw new Error("No default function export found in script");
			const defaultFunction = eval(`(${fnMatch[1]})`);

			const deps = this.extractDependencies(moduleInfo.content);

			URL.revokeObjectURL(moduleInfo.url);

			return { io: io as IOSchema, deps, defaultFunction };
		} catch (error: any) {
			URL.revokeObjectURL(moduleInfo.url);
			throw new Error(`Script introspection failed: ${error.message}`);
		}
	}

	/**
	 * Extract dependencies from script content
	 */
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

	/**
	 * Dispose resources
	 */
	dispose() {
		this.clearCache();
		this.resourceMonitor.dispose();
	}
}
