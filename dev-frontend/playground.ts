import { Synthase, ParameterUtils, type ScriptRegistry, type IOSchema } from "../src";
import { FormGenerator } from "./form-generator.js";
import { CUBOID_SCRIPT, CITY_SCRIPT, NEW_SCRIPT_TEMPLATE, HOUSE_SCRIPT, TREE_SCRIPT, ROAD_SCRIPT } from "./default-scripts.js";
import { SynthasePlayground } from "./synthase-playground.js";

// ==================== SCRIPT MANAGEMENT ====================

class PlaygroundScriptManager {
  private readonly STORAGE_KEY = 'synthase_playground_scripts';
  
  saveScript(name: string, content: string): void {
    const scripts = this.getAllScripts();
    scripts[name] = {
      content,
      lastModified: Date.now(),
      created: scripts[name]?.created || Date.now()
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scripts));
    console.log(`💾 Saved script: ${name}`);
  }
  
  loadScript(name: string): string | null {
    const scripts = this.getAllScripts();
    return scripts[name]?.content || null;
  }
  
  listScripts(): string[] {
    return Object.keys(this.getAllScripts());
  }
  
  deleteScript(name: string): void {
    const scripts = this.getAllScripts();
    delete scripts[name];
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(scripts));
    console.log(`🗑️ Deleted script: ${name}`);
  }
  
  scriptExists(name: string): boolean {
    return name in this.getAllScripts();
  }
  
  private getAllScripts(): Record<string, any> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  }
  
  initializeDefaults(): void {
    if (this.listScripts().length === 0) {
      // Fixed: Removed WELCOME_SCRIPT reference, added template first for better UX
      this.saveScript('template.synthase.js', NEW_SCRIPT_TEMPLATE);
      this.saveScript('cuboid.synthase.js', CUBOID_SCRIPT);
        this.saveScript('city.synthase.js', CITY_SCRIPT);
        this.saveScript('house.synthase.js', HOUSE_SCRIPT);
        this.saveScript('tree.synthase.js', TREE_SCRIPT);
        this.saveScript('road.synthase.js', ROAD_SCRIPT);
    }
  }
}

// ==================== SCRIPT REGISTRY ====================

class PlaygroundScriptRegistry implements ScriptRegistry {
  constructor(private scriptManager: PlaygroundScriptManager) {}
  
  async resolve(scriptId: string): Promise<string> {
    console.log(`🔍 Resolving script: ${scriptId}`);
    
    // 1. Try playground storage first
    const localScript = this.scriptManager.loadScript(scriptId);
    if (localScript) {
      console.log(`📝 Found in playground: ${scriptId}`);
      return localScript;
    }
    
    // 2. Try HTTP if it looks like a URL
    if (scriptId.startsWith('http://') || scriptId.startsWith('https://')) {
      console.log(`🌐 Fetching from URL: ${scriptId}`);
      const response = await fetch(scriptId);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${scriptId}: ${response.status} ${response.statusText}`);
      }
      return response.text();
    }
    
    // 3. Treat as inline script if it starts with 'export'
    if (scriptId.trim().startsWith('export')) {
      console.log(`📄 Using inline script`);
      return scriptId;
    }
    
    throw new Error(`Script not found: ${scriptId}`);
  }
}

// ==================== INITIALIZE WITH DEBUG FEATURES ====================

let playground: SynthasePlayground;

document.addEventListener('DOMContentLoaded', async () => {
  playground = new SynthasePlayground();
  console.log('🎮 Synthase Playground initialized with smart caching!');

  // Expose playground to global scope for debugging
  (window as any).playground = playground;
  
  // ==================== DEBUG CONSOLE COMMANDS ====================
  
  (window as any).synthaseDebug = {
    
    // Get comprehensive cache and system information
    info: () => {
      const info = playground.getCacheInfo();
      console.log('📊 Synthase Playground Information:', info);
      return info;
    },

    // Get detailed cache statistics
    cacheInfo: () => {
      const info = playground.getCacheInfo();
      console.log('📊 Cache Information:', info.synthaseCache);
      console.log(`📚 Scripts in localStorage: ${info.totalScripts}`);
      console.log(`📝 Current script: ${info.currentScript}`);
      console.log(`🔧 Has active job: ${info.hasJob}`);
      return info;
    },

    // Clear all caches
    clearCache: () => {
      playground.clearAllCaches();
      console.log('🗑️ All caches cleared - scripts will be re-planned on next execution');
    },

    // Configure cache policy  
    setCachePolicy: (maxAge: number = 10 * 60 * 1000, maxSize: number = 50) => {
      playground.configureCachePolicy(maxAge, maxSize);
      console.log(`⚙️ Cache policy updated: ${maxAge/1000}s max age, ${maxSize} max entries`);
    },

    // Test dependency resolution (comprehensive test)
    testDependencies: async () => {
      console.log('🧪 Testing dependency resolution system...');
      try {
        // Test 1: Basic dependency resolution
        console.log('Test 1: Basic cuboid import...');
        const testScript1 = `
          export const io = { 
            inputs: { size: { type: 'int', default: 5 } },
            outputs: { result: { type: 'string' } }
          };
          export default async function test({ size }, { importScript, Logger }) {
            Logger.info('Testing basic import');
            const cuboid = await importScript('cuboid.synthase.js');
            Logger.info('Import successful');
            return { 
              result: 'Basic import test passed',
              hasCuboidFunction: typeof cuboid === 'function',
              cuboidIO: !!cuboid.io
            };
          }
        `;
        
        const job1 = await playground.synthase_debug.plan(testScript1, 'test1');
        const result1 = await job1.call({ size: 5 });
        console.log('✅ Test 1 result:', result1);
        
        // Test 2: Nested dependency (city -> cuboid)
        console.log('Test 2: Nested dependency (city -> cuboid)...');
        const testScript2 = `
          export const io = { 
            inputs: {},
            outputs: { result: { type: 'string' } }
          };
          export default async function test({}, { importScript, Logger }) {
            Logger.info('Testing nested import');
            const city = await importScript('city.synthase.js');
            Logger.info('City import successful');
            
            // Test a small city to verify cuboid import works within city
            const result = await city({
              gridSize: 2,
              plotSize: 8,
              buildingDensity: 0.5,
              minHeight: 2,
              maxHeight: 3,
              buildingStyle: 'modern',
              groundMaterial: 'minecraft:stone',
              addDecorations: false,
              centralPlaza: false,
              seed: 'test'
            });
            
            return { 
              result: 'Nested dependency test passed',
              cityGenerated: !!result.schematic,
              buildingsCount: result.statistics?.buildingsGenerated || 0
            };
          }
        `;
        
        const job2 = await playground.synthase_debug.plan(testScript2, 'test2');
        const result2 = await job2.call({});
        console.log('✅ Test 2 result:', result2);
        
        // Test 3: Cache effectiveness
        console.log('Test 3: Cache effectiveness...');
        const cacheStatsBefore = playground.getCacheInfo().synthaseCache;
        
        // Run the same test again - should use cache
        const job3 = await playground.synthase_debug.plan(testScript1, 'test3');
        const result3 = await job3.call({ size: 3 });
        
        const cacheStatsAfter = playground.getCacheInfo().synthaseCache;
        
        console.log('✅ Test 3 - Cache stats before:', cacheStatsBefore);
        console.log('✅ Test 3 - Cache stats after:', cacheStatsAfter);
        console.log('✅ Test 3 result:', result3);
        
        console.log('🎉 All dependency tests passed!');
        
        return {
          test1: result1,
          test2: result2,
          test3: result3,
          cacheImprovement: {
            entriesBefore: cacheStatsBefore.totalEntries,
            entriesAfter: cacheStatsAfter.totalEntries,
            avgAgeBefore: cacheStatsBefore.avgAge,
            avgAgeAfter: cacheStatsAfter.avgAge
          }
        };
        
      } catch (error) {
        console.error('❌ Dependency test failed:', error);
        console.log('💡 Try running synthaseDebug.clearCache() and test again');
        throw error;
      }
    },

    // Test URL imports (if enabled)
    testUrlImport: async (url: string) => {
      console.log(`🌐 Testing URL import: ${url}`);
      try {
        const testScript = `
          export const io = { inputs: {}, outputs: { result: { type: 'string' } } };
          export default async function test({}, { importScript }) {
            const imported = await importScript('${url}');
            return { result: 'URL import successful', hasFunction: typeof imported === 'function' };
          }
        `;
        
        const job = await playground.synthase_debug.plan(testScript, 'urlTest');
        const result = await job.call({});
        console.log('✅ URL import test result:', result);
        return result;
        
      } catch (error) {
        console.error('❌ URL import test failed:', error);
        throw error;
      }
    },

    // Performance benchmarks
    benchmark: async (iterations: number = 5) => {
      console.log(`⏱️ Running performance benchmark (${iterations} iterations)...`);
      
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        
        const job = await playground.synthase_debug.plan(`
          export const io = { inputs: {}, outputs: { result: { type: 'object' } } };
          export default async function benchmark({}, { importScript }) {
            const cuboid = await importScript('cuboid.synthase.js');
            const result = await cuboid({
              width: 5, height: 5, depth: 5,
              material: 'minecraft:stone',
              hollow: false,
              addFoundation: false
            });
            return result;
          }
        `, `benchmark${i}`);
        
        await job.call({});
        
        const end = performance.now();
        times.push(end - start);
        
        console.log(`Iteration ${i + 1}: ${(end - start).toFixed(2)}ms`);
      }
      
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      
      const results = {
        iterations,
        avgTime: Math.round(avgTime * 100) / 100,
        minTime: Math.round(minTime * 100) / 100,
        maxTime: Math.round(maxTime * 100) / 100,
        times
      };
      
      console.log('📊 Benchmark results:', results);
      return results;
    },

    // Advanced cache analysis
    analyzeCacheEfficiency: () => {
      const stats = playground.getCacheInfo().synthaseCache;
      const analysis = {
        ...stats,
        efficiency: stats.totalEntries > 0 ? 'Cache is active' : 'No cache entries',
        recommendations: []
      };
      
      if (stats.avgAge > 300) { // 5 minutes
        analysis.recommendations.push('Consider reducing cache max age - entries are getting old');
      }
      
      if (stats.totalEntries === 0) {
        analysis.recommendations.push('No cache entries - try running some scripts first');
      }
      
      console.log('🔍 Cache efficiency analysis:', analysis);
      return analysis;
    },

    // List all available debug functions
    help: () => {
      console.log(`
🔧 Synthase Debug Commands:

📊 Information:
  synthaseDebug.info()                    - Complete system information
  synthaseDebug.cacheInfo()              - Detailed cache statistics
  synthaseDebug.analyzeCacheEfficiency() - Cache efficiency analysis

🧪 Testing:
  synthaseDebug.testDependencies()       - Comprehensive dependency tests
  synthaseDebug.testUrlImport(url)       - Test importing from URL
  synthaseDebug.benchmark(iterations)    - Performance benchmark

⚙️ Configuration:
  synthaseDebug.setCachePolicy(maxAge, maxSize) - Configure cache settings
  synthaseDebug.clearCache()             - Clear all caches

🚀 Performance:
  synthaseDebug.benchmark(5)             - Run performance tests

💡 Examples:
  synthaseDebug.setCachePolicy(5*60*1000, 100)  // 5min, 100 entries
  synthaseDebug.testDependencies()               // Test city->cuboid import
  synthaseDebug.benchmark(3)                     // 3 iterations benchmark
      `);
    }
  };

  // Welcome message with debug info
  console.log(`
🎮 Synthase Playground Ready!

🔧 Debug commands available - run synthaseDebug.help() for full list

Quick commands:
  synthaseDebug.info()             - System info
  synthaseDebug.testDependencies() - Test script imports  
  synthaseDebug.clearCache()       - Reset cache
  
  playground.*                     - Full playground access
  `);
  
  // Auto-run dependency test in development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('🧪 Development mode detected - running auto dependency test...');
    setTimeout(async () => {
      try {
        await (window as any).synthaseDebug.testDependencies();
        console.log('✅ Auto dependency test completed successfully!');
      } catch (error) {
        console.log('⚠️ Auto dependency test failed - but that\'s okay, you can debug manually');
      }
    }, 2000);
  }
});