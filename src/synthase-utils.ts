// synthase-utils.ts
import { Synthase } from "./synthase";
import type {
	ScriptContentResolver,
	SynthaseConfig,
	ParameterSpec,
} from "./types";

/**
 * Configuration options for quick execution (now extends SynthaseConfig)
 */
export interface QuickExecuteOptions extends SynthaseConfig {
	strict?: boolean; // Whether to throw on validation warnings
}

/**
 * Quick execute: plan and run a script in one call
 * This is a convenience wrapper for API endpoints and simple usage
 */
export async function execute(
	scriptContentOrResolver: string | ScriptContentResolver,
	inputs: Record<string, any>,
	options: QuickExecuteOptions = {}
): Promise<any> {
	console.log("🚀 Quick execute: creating Synthase and running script");

	// Create Synthase instance with new config structure
	const synthase = new Synthase(scriptContentOrResolver, options);

	// Configure cache policy if provided (now handled in constructor via options)
	if (options.cachePolicy) {
		synthase.setCachePolicy(options.cachePolicy);
	}

	try {
		// Execute the script
		const result = await synthase.call(inputs);

		console.log("✅ Quick execute completed successfully");
		return result;
	} catch (error: any) {
		console.error("❌ Quick execute failed:", error.message);
		throw error;
	} finally {
		// Clean up resources
		synthase.dispose();
	}
}

/**
 * Validate script without executing it
 */
export async function validate(
	scriptContentOrResolver: string | ScriptContentResolver,
	options: QuickExecuteOptions = {}
): Promise<{
	valid: boolean;
	io: any;
	dependencies: string[];
	errors?: string[];
}> {
	console.log("🔍 Validating script");

	const synthase = new Synthase(scriptContentOrResolver, options);

	try {
		// Wait for initialization to complete so IO schema and dependencies are available
		await synthase.waitForInitialization();

		// Get IO schema and dependencies (this should now work after initialization)
		const io = synthase.getIO();
		const dependencies = synthase.getDependencies();

		console.log("✅ Script validation completed");
		return {
			valid: true,
			io,
			dependencies,
		};
	} catch (error: any) {
		console.log("❌ Script validation failed:", error.message);
		return {
			valid: false,
			io: null,
			dependencies: [],
			errors: [error.message],
		};
	} finally {
		synthase.dispose();
	}
}

/**
 * Execute with validation - validates inputs against schema before execution
 */
export async function executeWithValidation(
	scriptContentOrResolver: string | ScriptContentResolver,
	inputs: Record<string, any>,
	options: QuickExecuteOptions = {}
): Promise<any> {
	console.log("🔍 Execute with validation: validating script first");

	// First validate the script
	const validation = await validate(scriptContentOrResolver, options);

	if (!validation.valid) {
		throw new Error(
			`Script validation failed: ${validation.errors?.join(", ")}`
		);
	}

	if (!validation.io) {
		throw new Error("No IO schema found in script");
	}

	// Validate inputs against IO schema
	try {
		const { ParameterUtils } = await import("./types");

		const inputsWithDefaults = ParameterUtils.applyDefaults(
			inputs,
			validation.io.inputs
		);

		for (const [key, spec] of Object.entries(validation.io.inputs)) {
			// Cast spec to ParameterSpec to fix type error
			const paramSpec = spec as ParameterSpec;

			if (!ParameterUtils.shouldShowParameter(paramSpec, inputsWithDefaults))
				continue;

			if (key in inputsWithDefaults) {
				ParameterUtils.validateParameter(
					inputsWithDefaults[key],
					paramSpec,
					key
				);
			} else {
				throw new Error(`Missing required input: ${key}`);
			}
		}

		console.log("✅ Input validation passed");

		// Now execute with validated inputs
		return await execute(scriptContentOrResolver, inputsWithDefaults, options);
	} catch (error: any) {
		throw new Error(`Input validation failed: ${error.message}`);
	}
}

/**
 * Batch execute multiple scripts
 */
export async function executeBatch(
	scripts: Array<{
		content: string | ScriptContentResolver;
		inputs: Record<string, any>;
		id?: string;
	}>,
	options: QuickExecuteOptions = {}
): Promise<
	Array<{
		id?: string;
		success: boolean;
		result?: any;
		error?: string;
	}>
> {
	console.log(`🚀 Batch execute: running ${scripts.length} scripts`);

	const results = [];

	for (let i = 0; i < scripts.length; i++) {
		const script = scripts[i];
		const scriptId = script.id || `script-${i}`;

		try {
			console.log(
				`📝 Executing batch script ${i + 1}/${scripts.length}: ${scriptId}`
			);

			const result = await execute(script.content, script.inputs, options);

			results.push({
				id: scriptId,
				success: true,
				result,
			});
		} catch (error: any) {
			console.error(`❌ Batch script ${scriptId} failed:`, error.message);

			results.push({
				id: scriptId,
				success: false,
				error: error.message,
			});
		}
	}

	const successCount = results.filter((r) => r.success).length;
	console.log(
		`✅ Batch execute completed: ${successCount}/${scripts.length} successful`
	);

	return results;
}

/**
 * Create a reusable Synthase instance with caching
 * Useful when you want to execute the same script multiple times with different inputs
 */
export async function createReusable(
	scriptContentOrResolver: string | ScriptContentResolver,
	options: QuickExecuteOptions = {}
): Promise<{
	synthase: Synthase;
	execute: (inputs: Record<string, any>) => Promise<any>;
	getIO: () => any;
	getDependencies: () => string[];
	dispose: () => void;
}> {
	console.log("🔧 Creating reusable Synthase instance");

	const synthase = new Synthase(scriptContentOrResolver, options);

	// Configure cache policy if provided
	if (options.cachePolicy) {
		synthase.setCachePolicy(options.cachePolicy);
	}

	// Return convenient wrapper
	return {
		synthase,
		execute: (inputs: Record<string, any>) => synthase.call(inputs),
		getIO: () => synthase.getIO(),
		getDependencies: () => synthase.getDependencies(),
		dispose: () => synthase.dispose(),
	};
}

/**
 * Hot reload helper - useful for development
 */
export async function createHotReloadable(
	getScript: () => string | ScriptContentResolver,
	options: QuickExecuteOptions = {}
): Promise<{
	execute: (inputs: Record<string, any>) => Promise<any>;
	reload: () => Promise<void>;
	getIO: () => any;
	dispose: () => void;
}> {
	let synthase = new Synthase(getScript(), options);

	if (options.cachePolicy) {
		synthase.setCachePolicy(options.cachePolicy);
	}

	return {
		execute: (inputs: Record<string, any>) => synthase.call(inputs),

		reload: async () => {
			console.log("🔄 Hot reloading script");
			synthase.dispose();
			synthase = new Synthase(getScript(), options);
			if (options.cachePolicy) {
				synthase.setCachePolicy(options.cachePolicy);
			}
			console.log("✅ Hot reload completed");
		},

		getIO: () => synthase.getIO(),

		dispose: () => synthase.dispose(),
	};
}

/**
 * Performance benchmark helper
 */
export async function benchmark(
	scriptContentOrResolver: string | ScriptContentResolver,
	inputs: Record<string, any>,
	iterations: number = 5,
	options: QuickExecuteOptions = {}
): Promise<{
	averageTime: number;
	minTime: number;
	maxTime: number;
	times: number[];
	results: any[];
}> {
	console.log(`⏱️ Benchmarking script (${iterations} iterations)`);

	const times: number[] = [];
	const results: any[] = [];

	// Create reusable instance to avoid planning overhead in each iteration
	const reusable = await createReusable(scriptContentOrResolver, options);

	try {
		for (let i = 0; i < iterations; i++) {
			const start = performance.now();
			const result = await reusable.execute(inputs);
			const end = performance.now();

			const time = end - start;
			times.push(time);
			results.push(result);

			console.log(`Iteration ${i + 1}: ${time.toFixed(2)}ms`);
		}

		const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
		const minTime = Math.min(...times);
		const maxTime = Math.max(...times);

		const benchmarkResults = {
			averageTime: Math.round(averageTime * 100) / 100,
			minTime: Math.round(minTime * 100) / 100,
			maxTime: Math.round(maxTime * 100) / 100,
			times,
			results,
		};

		console.log("📊 Benchmark results:", benchmarkResults);
		return benchmarkResults;
	} finally {
		reusable.dispose();
	}
}

/**
 * Legacy class export for backward compatibility
 * @deprecated Use individual functions instead
 */
export const SynthaseUtils = {
	execute,
	executeWithValidation,
	validate,
	executeBatch,
	createReusable,
	createHotReloadable,
	benchmark,
};
