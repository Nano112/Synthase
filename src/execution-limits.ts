// execution-limits.ts
/**
 * Manages execution limits and timeouts for script execution
 */
export class ExecutionLimits {
	public readonly timeout: number = 30000; // 30 seconds max execution
	public readonly maxRecursionDepth: number = 10; // Max import recursion depth
	public readonly maxImportedScripts: number = 50; // Max total imported scripts per execution
	public readonly maxMemory: number = 100 * 1024 * 1024; // 100MB memory limit

	constructor(
		limits?: Partial<{
			timeout: number;
			maxRecursionDepth: number;
			maxImportedScripts: number;
			maxMemory: number;
		}>
	) {
		if (limits) {
			Object.assign(this, limits);
		}

		console.log(`⚙️ Execution limits configured:`, {
			timeout: `${this.timeout}ms`,
			maxRecursionDepth: this.maxRecursionDepth,
			maxImportedScripts: this.maxImportedScripts,
			maxMemory: `${Math.round(this.maxMemory / 1024 / 1024)}MB`,
		});
	}

	/**
	 * Execute a function with timeout protection
	 */
	async executeWithTimeout<T>(
		fn: () => Promise<T>,
		timeoutMs: number = this.timeout
	): Promise<T> {
		const timeoutPromise = new Promise<never>((_, reject) => {
			const timeoutId = setTimeout(() => {
				reject(new Error(`Script execution timeout after ${timeoutMs}ms`));
			}, timeoutMs);

			// Store timeout ID for potential cleanup
			(timeoutPromise as any)._timeoutId = timeoutId;
		});

		try {
			const result = await Promise.race([fn(), timeoutPromise]);

			// Clear timeout if execution completed successfully
			const timeoutId = (timeoutPromise as any)._timeoutId;
			if (timeoutId) clearTimeout(timeoutId);

			return result;
		} catch (error: any) {
			// Clear timeout on error too
			const timeoutId = (timeoutPromise as any)._timeoutId;
			if (timeoutId) clearTimeout(timeoutId);

			if (error.message.includes("timeout")) {
				console.error(`❌ Script execution timeout (${timeoutMs}ms)`);
				throw new Error(
					`Script execution exceeded time limit (${timeoutMs / 1000}s)`
				);
			}
			throw error;
		}
	}

	/**
	 * Check if recursion depth is within limits
	 */
	checkRecursionDepth(currentDepth: number): void {
		if (currentDepth >= this.maxRecursionDepth) {
			throw new Error(
				`Recursion depth limit exceeded: ${currentDepth} >= ${this.maxRecursionDepth}. ` +
					`This may indicate circular dependencies or excessive nesting.`
			);
		}
	}

	/**
	 * Check if import count is within limits
	 */
	checkImportCount(currentCount: number): void {
		if (currentCount >= this.maxImportedScripts) {
			throw new Error(
				`Import limit exceeded: ${currentCount} >= ${this.maxImportedScripts}. ` +
					`This may indicate an import bomb or inefficient script design.`
			);
		}
	}

	/**
	 * Update limits configuration
	 */
	updateLimits(
		newLimits: Partial<{
			timeout: number;
			maxRecursionDepth: number;
			maxImportedScripts: number;
			maxMemory: number;
		}>
	): void {
		Object.assign(this, newLimits);
		console.log(`⚙️ Execution limits updated:`, newLimits);
	}
}
