// script-validator.ts
/**
 * Validates script content for safety and correctness
 */
export class ScriptValidator {
	private dangerousPatterns = [
		// Infinite loops
		{
			pattern: /while\s*\(\s*true\s*\)/,
			message: "Potential infinite while loop detected",
		},
		{
			pattern: /for\s*\(\s*;\s*;\s*\)/,
			message: "Potential infinite for loop detected",
		},
		{
			pattern: /for\s*\(\s*;[^;]*;\s*\)/,
			message: "Potential infinite for loop (no increment) detected",
		},

		// Dangerous globals access
		{ pattern: /eval\s*\(/, message: "Use of eval() is prohibited" },
		{
			pattern: /Function\s*\(/,
			message: "Use of Function constructor is prohibited",
		},
		{
			pattern: /setTimeout\s*\([^,]*,\s*0\s*\)/,
			message: "Zero-delay setTimeout may cause performance issues",
		},
		{
			pattern: /setInterval\s*\(/,
			message: "Use of setInterval is discouraged",
		},

		// File system access (in browser context)
		{
			pattern: /require\s*\(\s*['"]fs['"]/,
			message: "File system access is not allowed",
		},
		{
			pattern: /import.*['"]fs['"]/,
			message: "File system access is not allowed",
		},

		// Network access patterns that might be suspicious
		{
			pattern: /fetch\s*\([^)]*document\.location/,
			message: "Fetching from document.location may be suspicious",
		},
		{
			pattern: /XMLHttpRequest/,
			message: "Direct XMLHttpRequest usage is discouraged - use fetch instead",
		},

		// Prototype pollution attempts
		{ pattern: /__proto__/, message: "Prototype manipulation is prohibited" },
		{
			pattern: /constructor\.prototype/,
			message: "Prototype manipulation is prohibited",
		},

		// Very large loops (potential DoS)
		{
			pattern: /for\s*\([^)]*[0-9]{6,}/,
			message: "Very large loop detected - potential DoS",
		},
		{
			pattern: /while\s*\([^)]*[0-9]{6,}/,
			message: "Very large loop detected - potential DoS",
		},
	];

	private requiredPatterns = [
		{
			pattern: /export\s+const\s+io\s*=/,
			message: "Missing required 'export const io = ...' declaration",
		},
		{
			pattern: /export\s+default/,
			message: "Missing required 'export default function' declaration",
		},
	];

	/**
	 * Validate script content
	 */
	validateScript(content: string): {
		valid: boolean;
		errors: string[];
		warnings: string[];
	} {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Check for required patterns
		for (const required of this.requiredPatterns) {
			if (!required.pattern.test(content)) {
				errors.push(required.message);
			}
		}

		// Check for dangerous patterns
		for (const danger of this.dangerousPatterns) {
			if (danger.pattern.test(content)) {
				errors.push(danger.message);
			}
		}

		// Additional structural validation
		this.validateStructure(content, errors, warnings);

		// Validate IO schema if possible
		this.validateIOSchema(content, errors, warnings);

		return {
			valid: errors.length === 0,
			errors,
			warnings,
		};
	}

	/**
	 * Validate script structure
	 */
	private validateStructure(
		content: string,
		errors: string[],
		warnings: string[]
	): void {
		// Check for basic syntax issues with ES6 modules
		try {
			// For ES6 modules, we can't use new Function() directly
			// Instead, we'll do basic checks for common syntax issues

			// Check for unmatched quotes
			if (!this.hasMatchedQuotes(content)) {
				errors.push("Syntax error: Unmatched quotes detected");
				return;
			}

			// Check for basic ES6 module structure
			if (!content.includes("export")) {
				errors.push(
					"Syntax error: No export statements found - scripts must be ES6 modules"
				);
				return;
			}
		} catch (syntaxError: any) {
			errors.push(`Syntax error: ${syntaxError.message}`);
			return; // Don't continue if basic syntax is wrong
		}

		// Check for unmatched braces/parentheses
		const braceBalance = this.checkBraceBalance(content);
		if (braceBalance !== 0) {
			errors.push("Unmatched braces detected");
		}

		// Check for very long lines (might indicate minified/obfuscated code)
		const lines = content.split("\n");
		for (let i = 0; i < lines.length; i++) {
			if (lines[i].length > 1000) {
				warnings.push(
					`Very long line detected at line ${i + 1} - possible minified code`
				);
				break; // Only warn once
			}
		}

		// Check for excessive nesting
		const maxNesting = this.getMaxNestingLevel(content);
		if (maxNesting > 10) {
			warnings.push(
				`High nesting level (${maxNesting}) detected - consider refactoring`
			);
		}

		// Check script length
		if (content.length > 100000) {
			// 100KB
			warnings.push(
				"Script is very large - consider breaking into smaller modules"
			);
		}
	}

	/**
	 * Check if quotes are properly matched in code
	 */
	private hasMatchedQuotes(content: string): boolean {
		let singleQuotes = 0;
		let doubleQuotes = 0;
		let templateQuotes = 0;
		let inComment = false;

		for (let i = 0; i < content.length; i++) {
			const char = content[i];
			const nextChar = content[i + 1];
			const prevChar = content[i - 1];

			// Handle comments
			if (char === "/" && nextChar === "/") {
				inComment = true;
				continue;
			}
			if (char === "/" && nextChar === "*") {
				inComment = true;
				continue;
			}
			if (inComment && char === "\n") {
				inComment = false;
				continue;
			}
			if (inComment && char === "*" && nextChar === "/") {
				inComment = false;
				i++; // Skip the '/'
				continue;
			}

			if (inComment) continue;

			// Count unescaped quotes
			if (char === '"' && prevChar !== "\\") doubleQuotes++;
			if (char === "'" && prevChar !== "\\") singleQuotes++;
			if (char === "`" && prevChar !== "\\") templateQuotes++;
		}

		return (
			singleQuotes % 2 === 0 &&
			doubleQuotes % 2 === 0 &&
			templateQuotes % 2 === 0
		);
	}

	/**
	 * Validate IO schema structure
	 */
	private validateIOSchema(
		content: string,
		errors: string[],
		warnings: string[]
	): void {
		try {
			// More robust regex to match the io export
			// This handles multiline objects better
			const ioMatch = content.match(
				/export\s+const\s+io\s*=\s*(\{[\s\S]*?\});/
			);
			if (!ioMatch) {
				// Try alternative format without trailing semicolon
				const altMatch = content.match(
					/export\s+const\s+io\s*=\s*(\{[\s\S]*?\})/
				);
				if (!altMatch) return; // Already caught by required patterns
			}

			const ioText = ioMatch
				? ioMatch[1]
				: content.match(/export\s+const\s+io\s*=\s*(\{[\s\S]*?\})/)?.[1];
			if (!ioText) return;

			// Try to evaluate the IO schema
			const ioSchema = eval(`(${ioText})`);

			// Validate schema structure
			if (typeof ioSchema !== "object" || ioSchema === null) {
				errors.push("IO schema must be an object");
				return;
			}

			// Check for required properties
			if (!ioSchema.inputs || typeof ioSchema.inputs !== "object") {
				errors.push("IO schema must have an 'inputs' object");
			}

			if (!ioSchema.outputs || typeof ioSchema.outputs !== "object") {
				errors.push("IO schema must have an 'outputs' object");
			}

			// Validate parameter definitions
			if (ioSchema.inputs) {
				this.validateParameterDefinitions(
					ioSchema.inputs,
					"inputs",
					errors,
					warnings
				);
			}

			if (ioSchema.outputs) {
				this.validateParameterDefinitions(
					ioSchema.outputs,
					"outputs",
					errors,
					warnings
				);
			}
		} catch (ioError: any) {
			errors.push(`Invalid IO schema: ${ioError.message}`);
		}
	}

	/**
	 * Validate parameter definitions in IO schema
	 */
	private validateParameterDefinitions(
		params: any,
		section: string,
		errors: string[],
		warnings: string[]
	): void {
		const validTypes = [
			"int",
			"float",
			"string",
			"boolean",
			"object",
			"array",
			"BlockId",
		];

		for (const [key, param] of Object.entries(params)) {
			if (typeof param === "string") {
				// Legacy format - just check if it's a valid type
				if (!validTypes.includes(param)) {
					errors.push(
						`Invalid parameter type '${param}' for ${section}.${key}`
					);
				}
			} else if (typeof param === "object" && param !== null) {
				// Enhanced format
				const paramObj = param as any;

				if (!paramObj.type || !validTypes.includes(paramObj.type)) {
					errors.push(`Invalid or missing type for ${section}.${key}`);
				}

				// Check for type-specific validation
				if (paramObj.type === "int" || paramObj.type === "float") {
					if (
						paramObj.min !== undefined &&
						paramObj.max !== undefined &&
						paramObj.min > paramObj.max
					) {
						errors.push(
							`Invalid range for ${section}.${key}: min (${paramObj.min}) > max (${paramObj.max})`
						);
					}
				}

				if (
					paramObj.type === "string" &&
					paramObj.options &&
					!Array.isArray(paramObj.options)
				) {
					errors.push(`Options for ${section}.${key} must be an array`);
				}

				// Warn about very large option lists
				if (
					paramObj.options &&
					Array.isArray(paramObj.options) &&
					paramObj.options.length > 100
				) {
					warnings.push(
						`Large options list (${paramObj.options.length}) for ${section}.${key} - consider using autocomplete`
					);
				}
			} else {
				errors.push(
					`Invalid parameter definition for ${section}.${key} - must be string or object`
				);
			}
		}
	}

	/**
	 * Check brace balance in code
	 */
	private checkBraceBalance(content: string): number {
		let balance = 0;
		let inString = false;
		let inComment = false;
		let stringChar = "";

		for (let i = 0; i < content.length; i++) {
			const char = content[i];
			const nextChar = content[i + 1];

			// Handle string literals
			if (!inComment && (char === '"' || char === "'" || char === "`")) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar && content[i - 1] !== "\\") {
					inString = false;
					stringChar = "";
				}
				continue;
			}

			// Handle comments
			if (!inString) {
				if (char === "/" && nextChar === "/") {
					inComment = true;
					continue;
				}
				if (char === "/" && nextChar === "*") {
					inComment = true;
					continue;
				}
				if (inComment && char === "\n") {
					inComment = false;
					continue;
				}
				if (inComment && char === "*" && nextChar === "/") {
					inComment = false;
					i++; // Skip the '/'
					continue;
				}
			}

			// Count braces outside strings and comments
			if (!inString && !inComment) {
				if (char === "{") balance++;
				if (char === "}") balance--;
			}
		}

		return balance;
	}

	/**
	 * Get maximum nesting level in code
	 */
	private getMaxNestingLevel(content: string): number {
		let maxNesting = 0;
		let currentNesting = 0;
		let inString = false;
		let inComment = false;
		let stringChar = "";

		for (let i = 0; i < content.length; i++) {
			const char = content[i];
			const nextChar = content[i + 1];

			// Handle string literals (same logic as brace balance)
			if (!inComment && (char === '"' || char === "'" || char === "`")) {
				if (!inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar && content[i - 1] !== "\\") {
					inString = false;
					stringChar = "";
				}
				continue;
			}

			// Handle comments (same logic as brace balance)
			if (!inString) {
				if (char === "/" && nextChar === "/") {
					inComment = true;
					continue;
				}
				if (char === "/" && nextChar === "*") {
					inComment = true;
					continue;
				}
				if (inComment && char === "\n") {
					inComment = false;
					continue;
				}
				if (inComment && char === "*" && nextChar === "/") {
					inComment = false;
					i++;
					continue;
				}
			}

			// Track nesting outside strings and comments
			if (!inString && !inComment) {
				if (char === "{") {
					currentNesting++;
					maxNesting = Math.max(maxNesting, currentNesting);
				}
				if (char === "}") {
					currentNesting--;
				}
			}
		}

		return maxNesting;
	}

	/**
	 * Add custom validation rule
	 */
	addDangerousPattern(pattern: RegExp, message: string): void {
		this.dangerousPatterns.push({ pattern, message });
		console.log(`⚠️ Added dangerous pattern: ${message}`);
	}

	/**
	 * Remove validation rule
	 */
	removeDangerousPattern(message: string): void {
		const index = this.dangerousPatterns.findIndex(
			(p) => p.message === message
		);
		if (index >= 0) {
			this.dangerousPatterns.splice(index, 1);
			console.log(`✅ Removed dangerous pattern: ${message}`);
		}
	}
}
