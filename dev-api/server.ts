import express from 'express';
import cors from 'cors';
import { Synthase, ParameterUtils } from "../src/index.js";

// ==================== SIMPLE SCRIPT REGISTRY ====================

class ApiScriptRegistry {
  private scripts = new Map<string, string>();

  constructor() {
    this.addDefaultScripts();
  }

  async resolve(scriptId: string): Promise<string> {
    const script = this.scripts.get(scriptId);
    if (!script) {
      throw new Error(`Script not found: ${scriptId}`);
    }
    return script;
  }

  addScript(name: string, content: string): void {
    this.scripts.set(name, content);
  }

  listScripts(): string[] {
    return Array.from(this.scripts.keys());
  }

  private addDefaultScripts(): void {
    // Simple test script
    this.addScript('test.synthase.js', `
      export const io = {
        inputs: {
          message: { type: 'string', default: 'Hello from API!' },
          count: { type: 'int', default: 1, min: 1, max: 10 }
        },
        outputs: {
          result: { type: 'string' },
          timestamp: { type: 'string' }
        }
      };

      export default async function test({ message, count }, { Logger }) {
        Logger.info(\`Processing message: \${message} (count: \${count})\`);
        
        const result = Array(count).fill(message).join(' ');
        const timestamp = new Date().toISOString();
        
        Logger.success('Test script completed successfully');
        
        return {
          result,
          timestamp,
          executedAt: new Date().toLocaleString()
        };
      }
    `);

    // Simple cuboid script for testing  
    this.addScript('simple-cuboid.synthase.js', `
      export const io = {
        inputs: {
          width: { type: 'int', default: 5, min: 1, max: 20 },
          height: { type: 'int', default: 5, min: 1, max: 20 },
          depth: { type: 'int', default: 5, min: 1, max: 20 },
          material: { type: 'string', default: 'minecraft:stone' }
        },
        outputs: {
          schematic: { type: 'object' },
          blocks: { type: 'int' }
        }
      };

      export default async function simpleCuboid({ width, height, depth, material }, { Logger, Schematic }) {
        Logger.info(\`Creating \${width}x\${height}x\${depth} cuboid with \${material}\`);
        
        const schematic = new Schematic(width, height, depth);
        let blockCount = 0;
        
        for (let x = 0; x < width; x++) {
          for (let y = 0; y < height; y++) {
            for (let z = 0; z < depth; z++) {
              schematic.setBlock(x, y, z, material);
              blockCount++;
            }
          }
        }
        
        Logger.success(\`Created cuboid with \${blockCount} blocks\`);
        
        return {
          schematic: schematic.toObject(),
          blocks: blockCount,
          dimensions: { width, height, depth },
          material
        };
      }
    `);
  }
}

// ==================== EXPRESS SERVER ====================

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path}`);
  next();
});

// Initialize Synthase
const registry = new ApiScriptRegistry();
const synthase = new Synthase(registry);

console.log('🔬 Initializing Synthase API server...');
console.log(`📚 Loaded ${registry.listScripts().length} default scripts`);

// ==================== API ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cache: synthase.getCacheStats()
  });
});

// List available scripts
app.get('/api/scripts', (req, res) => {
  try {
    const scripts = registry.listScripts();
    res.json({
      success: true,
      scripts,
      count: scripts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Failed to list scripts:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Plan script execution
app.post('/api/plan', async (req, res) => {
  try {
    const { scriptId, scriptContent } = req.body;

    if (!scriptId && !scriptContent) {
      return res.status(400).json({
        success: false,
        error: 'Either scriptId or scriptContent must be provided'
      });
    }

    let content: string;
    if (scriptContent) {
      content = scriptContent;
    } else {
      content = await registry.resolve(scriptId);
    }

    console.log(`🎯 Planning script: ${scriptId || 'inline'}`);
    const job = await synthase.plan(content, scriptId || 'inline');

    console.log(`✅ Script planned successfully`);

    res.json({
      success: true,
      io: job.io,
      dependencies: job.deps,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Planning failed:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Execute script (plan + execute)
app.post('/api/execute', async (req, res) => {
  try {
    const { scriptId, scriptContent, inputs } = req.body;

    if (!scriptId && !scriptContent) {
      return res.status(400).json({
        success: false,
        error: 'Either scriptId or scriptContent must be provided'
      });
    }

    if (!inputs || typeof inputs !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'inputs must be provided as an object'
      });
    }

    let content: string;
    if (scriptContent) {
      content = scriptContent;
    } else {
      content = await registry.resolve(scriptId);
    }

    console.log(`🚀 Executing script: ${scriptId || 'inline'}`);
    
    // Plan the script
    const job = await synthase.plan(content, scriptId || 'inline');
    
    // Validate inputs against schema
    const inputsWithDefaults = ParameterUtils.applyDefaults(inputs, job.io.inputs);
    
    for (const [key, spec] of Object.entries(job.io.inputs)) {
      if (!ParameterUtils.shouldShowParameter(spec, inputsWithDefaults)) continue;
      if (key in inputsWithDefaults) {
        ParameterUtils.validateParameter(inputsWithDefaults[key], spec, key);
      } else {
        throw new Error(`Missing required input: ${key}`);
      }
    }
    
    console.log(`🔧 Calling script with validated inputs`);
    const result = await job.call(inputsWithDefaults);

    console.log(`✅ Script executed successfully`);

    res.json({
      success: true,
      result,
      io: job.io,
      dependencies: job.deps,
      inputs: inputsWithDefaults,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('❌ Execution failed:', error.message);
    res.status(400).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get cache information
app.get('/api/cache', (req, res) => {
  try {
    const stats = synthase.getCacheStats();
    res.json({
      success: true,
      cache: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear cache
app.delete('/api/cache', (req, res) => {
  try {
    synthase.clearCache();
    console.log('🗑️ Cache cleared via API');
    res.json({
      success: true,
      message: 'Cache cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Simple HTML interface for testing
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Synthase API Server</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .endpoint { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
        pre { background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 4px; overflow-x: auto; }
      </style>
    </head>
    <body>
      <h1>🚀 Synthase API Server</h1>
      <p>Server is running on port ${PORT}</p>
      
      <h2>📡 Available Endpoints</h2>
      <div class="endpoint">GET /api/health - Health check</div>
      <div class="endpoint">GET /api/scripts - List available scripts</div>
      <div class="endpoint">POST /api/plan - Plan script execution</div>
      <div class="endpoint">POST /api/execute - Execute script</div>
      <div class="endpoint">GET /api/cache - Get cache stats</div>
      <div class="endpoint">DELETE /api/cache - Clear cache</div>
      
      <h2>🧪 Test Commands</h2>
      <pre>
# Health check
curl http://localhost:${PORT}/api/health

# List scripts  
curl http://localhost:${PORT}/api/scripts

# Execute test script
curl -X POST http://localhost:${PORT}/api/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "scriptId": "test.synthase.js",
    "inputs": {"message": "Hello API!", "count": 3}
  }'
      </pre>
    </body>
    </html>
  `);
});

// Error handling
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Server error:', error.message);
  res.status(500).json({
    success: false,
    error: error.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🎉 Synthase API server running on http://localhost:${PORT}`);
  console.log(`📚 Available scripts: ${registry.listScripts().join(', ')}`);
  console.log('🔧 Ready to process Synthase scripts!');
});