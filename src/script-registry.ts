/**
 * Resolves script URLs/names to actual script content
 */
export interface ScriptRegistry {
  resolve(scriptId: string): Promise<string>;
}

/**
 * In-memory script registry for development/testing
 */
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
}

/**
 * HTTP-based script registry for loading from URLs
 */
export class HttpScriptRegistry implements ScriptRegistry {
  constructor(private baseUrl?: string) {}

  async resolve(scriptId: string): Promise<string> {
    // Handle absolute URLs
    if (scriptId.startsWith('http://') || scriptId.startsWith('https://')) {
      console.log(`🌐 Fetching script from URL: ${scriptId}`);
      const response = await fetch(scriptId);
      if (!response.ok) {
        throw new Error(`Failed to fetch script: ${response.status} ${response.statusText}`);
      }
      return response.text();
    }

    // Handle relative URLs with base
    if (this.baseUrl) {
      const fullUrl = new URL(scriptId, this.baseUrl).toString();
      console.log(`🌐 Fetching script from: ${fullUrl}`);
      const response = await fetch(fullUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch script: ${response.status} ${response.statusText}`);
      }
      return response.text();
    }

    throw new Error(`Cannot resolve script: ${scriptId} (no base URL configured)`);
  }
}

/**
 * Composite registry that tries multiple sources
 */
export class CompositeScriptRegistry implements ScriptRegistry {
  constructor(private registries: ScriptRegistry[]) {}

  async resolve(scriptId: string): Promise<string> {
    for (const registry of this.registries) {
      try {
        return await registry.resolve(scriptId);
      } catch (error) {
        // Try next registry
        continue;
      }
    }
    throw new Error(`Script not found in any registry: ${scriptId}`);
  }
}