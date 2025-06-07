import { Synthase, ParameterUtils, type ScriptRegistry, type IOSchema } from "../src";
import { FormGenerator } from "./form-generator.js";
import { CUBOID_SCRIPT, CITY_SCRIPT, NEW_SCRIPT_TEMPLATE, HOUSE_SCRIPT, TREE_SCRIPT, ROAD_SCRIPT } from "./default-scripts.js";

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
      // Fixed: Removed WELCOME_SCRIPT reference
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

// ==================== MAIN PLAYGROUND CLASS ====================

export class SynthasePlayground {
  private scriptManager = new PlaygroundScriptManager();
  private scriptRegistry = new PlaygroundScriptRegistry(this.scriptManager);
  private synthase = new Synthase(this.scriptRegistry);
  private editor: any = null;
  private currentScript = 'template.synthase.js'; // Fixed: Default to template instead of welcome
  private currentJob: any = null;
  private formGenerator: FormGenerator | null = null;
  
  // Dynamic IO analysis properties
  private ioAnalysisTimeout: number | null = null;
  private lastAnalyzedContent: string = '';
  private lastExecutionResult: any = null;
  
  constructor() {
    // Configure cache policy for playground
    this.synthase.setCachePolicy({
      maxAge: 10 * 60 * 1000, // 10 minutes
      maxSize: 50             // 50 scripts max
    });
    
    this.initializeMonaco();
    this.initializeUI();
    this.scriptManager.initializeDefaults();
  }
  
  // ==================== MONACO EDITOR ====================
  
  private initializeMonaco(): void {
    (window as any).require.config({
      paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }
    });
    
    (window as any).require(['vs/editor/editor.main'], async () => {
      // Configure JavaScript language features
      monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
        target: monaco.languages.typescript.ScriptTarget.ES2020,
        allowNonTsExtensions: true,
        moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
        module: monaco.languages.typescript.ModuleKind.ESNext,
        noEmit: true,
        esModuleInterop: true,
        jsx: monaco.languages.typescript.JsxEmit.React,
        allowSyntheticDefaultImports: true,
      });
      
      // Create the editor
      this.editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: '',
        language: 'javascript',
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        lineNumbers: 'on',
        wordWrap: 'on',
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        folding: true,
        bracketMatching: 'always',
        suggest: {
          showKeywords: true,
          showSnippets: true,
        }
      });
      
      // Enhanced auto-save with dynamic IO analysis and cache invalidation
      let saveTimeout: number;
      this.editor.onDidChangeModelContent(() => {
        this.updateScriptStatus('●', 'text-yellow-400');
        
        // Dynamic IO analysis (debounced)
        this.analyzeScriptIODynamic(this.editor.getValue());
        
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
          await this.saveCurrentScript();
        }, 2000);
      });
      
      console.log('✅ Monaco Editor initialized with smart caching and dynamic IO');
      
      // Load initial script
      await this.loadScript(this.currentScript);
    });
  }
  
  // ==================== DYNAMIC IO ANALYSIS ====================
  
  private analyzeScriptIODynamic(content: string): void {
    // Don't re-analyze the same content
    if (content === this.lastAnalyzedContent) return;
    
    // Clear previous timeout
    if (this.ioAnalysisTimeout) {
      clearTimeout(this.ioAnalysisTimeout);
    }

    // Debounce analysis (500ms delay)
    this.ioAnalysisTimeout = window.setTimeout(() => {
      this.performQuickIOAnalysis(content);
      this.lastAnalyzedContent = content;
    }, 500);
  }

  private performQuickIOAnalysis(content: string): void {
    try {
      // Extract IO schema from script content without full planning
      const ioMatch = content.match(/export\s+const\s+io\s*=\s*({[\s\S]*?});/);
      if (!ioMatch) {
        console.log('⚠️ No IO schema found - keeping existing form');
        return;
      }

      // Parse IO schema
      const ioSchema = eval(`(${ioMatch[1]})`);
      
      // Only regenerate form if IO actually changed
      if (this.hasIOSchemaChanged(ioSchema)) {
        console.log('🔄 IO schema changed - updating parameter form');
        this.generateParameterFormQuick(ioSchema);
      }
      
    } catch (error) {
      console.log('⚠️ Invalid IO schema in editor - keeping existing form');
    }
  }

  private hasIOSchemaChanged(newSchema: any): boolean {
    if (!this.formGenerator || !this.currentJob) return true;
    
    // Compare input parameter keys and types
    const oldInputs = this.currentJob.io.inputs;
    const newInputs = newSchema.inputs || {};
    
    const oldKeys = Object.keys(oldInputs).sort();
    const newKeys = Object.keys(newInputs).sort();
    
    if (JSON.stringify(oldKeys) !== JSON.stringify(newKeys)) return true;
    
    // Check if parameter types changed
    for (const key of oldKeys) {
      if (oldInputs[key]?.type !== newInputs[key]?.type) return true;
    }
    
    return false;
  }

  private generateParameterFormQuick(ioSchema: any): void {
    const parametersContainer = document.getElementById('parameters-container');
    if (!parametersContainer) return;

    // Preserve download section if it exists
    const downloadSection = document.getElementById('schematic-downloads');
    const downloadHTML = downloadSection ? downloadSection.outerHTML : '';

    // Clear container
    parametersContainer.innerHTML = '';
    
    // Create new form generator
    this.formGenerator = new FormGenerator(
      parametersContainer,
      ioSchema.inputs || {},
      {
        onValueChange: (key, value, allValues) => {
          console.log(`📝 Parameter changed: ${key} = ${value}`);
        },
        onSubmit: (values) => {
          this.runScriptWithParameters(values);
        },
        className: 'text-white'
      }
    );

    // Restore download section
    if (downloadHTML) {
      parametersContainer.insertAdjacentHTML('beforeend', downloadHTML);
      this.rebindDownloadButtons();
    }

    console.log(`⚡ Parameter form updated dynamically (${Object.keys(ioSchema.inputs || {}).length} parameters)`);
  }

  private rebindDownloadButtons(): void {
    // Re-bind download button events after DOM update
    document.getElementById('download-schematic-btn')?.addEventListener('click', async () => {
      if (this.lastExecutionResult?.schematic) {
        try {
          const schematicData = await this.lastExecutionResult.schematic.to_schematic();
          const blob = new Blob([schematicData], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.currentScript.replace('.synthase.js', '')}.schem`;
          a.click();
          
          URL.revokeObjectURL(url);
          this.logToConsole(`💾 Downloaded schematic as .schem`, 'success');
        } catch (error) {
          this.logToConsole(`❌ Failed to export schematic: ${error.message}`, 'error');
        }
      }
    });

    document.getElementById('download-litematic-btn')?.addEventListener('click', async () => {
      if (this.lastExecutionResult?.schematic) {
        try {
          const litematicData = await this.lastExecutionResult.schematic.to_litematic();
          const blob = new Blob([litematicData], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          
          const a = document.createElement('a');
          a.href = url;
          a.download = `${this.currentScript.replace('.synthase.js', '')}.litematic`;
          a.click();
          
          URL.revokeObjectURL(url);
          this.logToConsole(`📋 Downloaded schematic as .litematic`, 'success');
        } catch (error) {
          this.logToConsole(`❌ Failed to export litematic: ${error.message}`, 'error');
        }
      }
    });
  }
  
  // ==================== UI INITIALIZATION ====================
  
  private initializeUI(): void {
    // Script actions
    document.getElementById('new-script-btn')?.addEventListener('click', () => this.showNewScriptModal());
    document.getElementById('save-script-btn')?.addEventListener('click', () => this.saveCurrentScript());
    document.getElementById('run-script-btn')?.addEventListener('click', () => this.runCurrentScript());
    document.getElementById('format-btn')?.addEventListener('click', () => this.formatCurrentScript());
    
    // Console actions
    document.getElementById('clear-console-btn')?.addEventListener('click', () => this.clearConsole());
    document.getElementById('toggle-console-btn')?.addEventListener('click', () => this.toggleConsole());
    
    // Import/Export
    document.getElementById('import-script-btn')?.addEventListener('click', () => this.importScript());
    document.getElementById('export-script-btn')?.addEventListener('click', () => this.exportCurrentScript());
    
    // Modal handlers
    document.getElementById('cancel-new-script')?.addEventListener('click', () => this.hideNewScriptModal());
    document.getElementById('create-new-script')?.addEventListener('click', () => this.createNewScript());
    
    // File input
    document.getElementById('file-input')?.addEventListener('change', (e) => this.handleFileImport(e as any));
    
    // Search
    document.getElementById('script-search')?.addEventListener('input', (e) => {
      this.filterScripts((e.target as HTMLInputElement).value);
    });
    
    // Initialize
    this.updateScriptsList();
    this.setupConsoleLogging();
  }
  
  // ==================== SCRIPT MANAGEMENT ====================
  
  private async loadScript(name: string): Promise<void> {
    const content = this.scriptManager.loadScript(name);
    if (content && this.editor) {
      this.editor.setValue(content);
      this.currentScript = name;
      this.updateCurrentScriptName(name);
      this.updateScriptStatus('●', 'text-green-400');
      this.updateScriptsList();
      
      // Generate parameter form
      await this.generateParameterForm(content);
      
      console.log(`📖 Loaded script: ${name}`);
    }
  }
  
  private async saveCurrentScript(): Promise<void> {
    if (!this.editor) return;
    
    const content = this.editor.getValue();
    
    // Invalidate cache for this script since content changed
    this.synthase.invalidateByContent(this.currentScript, content);
    
    this.scriptManager.saveScript(this.currentScript, content);
    this.updateScriptStatus('●', 'text-green-400');
    this.updateScriptsList();
    
    // Full regenerate parameter form with new content
    await this.generateParameterForm(content);
  }
  
  // ==================== PARAMETER FORM GENERATION ====================
  
  private async generateParameterForm(scriptContent: string): Promise<void> {
    try {
      this.logToConsole(`🔧 Analyzing script parameters...`, 'info');
      
      // Plan the script to get IO schema
      this.currentJob = await this.synthase.plan(scriptContent, this.currentScript);
      
      const parametersContainer = document.getElementById('parameters-container');
      if (!parametersContainer) return;
      
      // Clear container including any download buttons
      parametersContainer.innerHTML = '';
      
      // Create form generator
      this.formGenerator = new FormGenerator(
        parametersContainer,
        this.currentJob.io.inputs,
        {
          onValueChange: (key, value, allValues) => {
            console.log(`Parameter ${key} changed to:`, value);
          },
          onSubmit: (values) => {
            this.runScriptWithParameters(values);
          },
          className: 'text-white'
        }
      );
      
      this.logToConsole(`✅ Parameter form generated (${Object.keys(this.currentJob.io.inputs).length} parameters)`, 'success');
      
      // Show cache stats
      const cacheStats = this.synthase.getCacheStats();
      this.logToConsole(`📊 Cache: ${cacheStats.totalEntries} entries, avg age ${cacheStats.avgAge}s`, 'info');
      
    } catch (error) {
      this.logToConsole(`❌ Failed to analyze script: ${error.message}`, 'error');
      
      // Show error in parameters panel
      const parametersContainer = document.getElementById('parameters-container');
      if (parametersContainer) {
        parametersContainer.innerHTML = `
          <div class="text-red-400 text-center py-8">
            <div class="text-lg">⚠️ Script Error</div>
            <div class="text-sm mt-2">${error.message}</div>
          </div>
        `;
      }
    }
  }
  
  // ==================== SCRIPT EXECUTION ====================
  
  private async runCurrentScript(): Promise<void> {
    if (!this.formGenerator) {
      this.logToConsole('❌ No parameter form available. Please save the script first.', 'error');
      return;
    }
    
    const formValues = this.formGenerator.getValues();
    await this.runScriptWithParameters(formValues);
  }
  
  private async runScriptWithParameters(parameters: Record<string, any>): Promise<void> {
    this.logToConsole('🚀 Running script with parameters...', 'info');
    
    try {
      if (!this.currentJob) {
        throw new Error('No script job available. Please load a script first.');
      }
      
      this.logToConsole(`🎯 Parameters:`, 'info');
      this.logToConsole(JSON.stringify(parameters, null, 2), 'data');
      
      // Execute the script
      const result = await this.currentJob.call(parameters);
      this.lastExecutionResult = result; // Store for download buttons
      
      this.logToConsole(`🎉 Execution completed!`, 'success');
      this.logToConsole(`📤 Result:`, 'info');
      
      // Show cache stats after execution
      const cacheStats = this.synthase.getCacheStats();
      this.logToConsole(`📊 Cache: ${cacheStats.totalEntries} entries, avg age ${cacheStats.avgAge}s`, 'info');
      
      // Check if result contains a schematic
      if (result.schematic && typeof result.schematic.to_schematic === 'function') {
        this.logToConsole(`🏗️ Schematic generated! Use download buttons to save.`, 'success');
        this.showSchematicDownloadButtons(result.schematic);
        
        // Log result without the schematic object (too large)
        const resultCopy = { ...result };
        delete resultCopy.schematic;
        this.logToConsole(JSON.stringify(resultCopy, null, 2), 'data');
      } else {
        this.logToConsole(JSON.stringify(result, null, 2), 'data');
      }
      
    } catch (error) {
      this.logToConsole(`❌ Execution failed: ${error.message}`, 'error');
      console.error('Script execution failed:', error);
    }
  }
  
  /**
   * Show download buttons for generated schematic
   */
  private showSchematicDownloadButtons(schematic: any): void {
    const parametersContainer = document.getElementById('parameters-container');
    if (!parametersContainer) return;
    
    // Add download section if it doesn't exist
    let downloadSection = document.getElementById('schematic-downloads');
    if (!downloadSection) {
      downloadSection = document.createElement('div');
      downloadSection.id = 'schematic-downloads';
      downloadSection.className = 'mt-6 pt-4 border-t border-gray-600';
      downloadSection.innerHTML = `
        <h4 class="text-sm font-medium text-gray-300 mb-3">📦 Download Generated Schematic</h4>
        <div class="space-y-2">
          <button id="download-schematic-btn" class="w-full bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm transition-colors">
            💾 Download .schem
          </button>
          <button id="download-litematic-btn" class="w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm transition-colors">
            📋 Download .litematic
          </button>
        </div>
      `;
      parametersContainer.appendChild(downloadSection);
      
      // Bind download buttons
      this.rebindDownloadButtons();
    }
  }
  
  // ==================== DEBUG METHODS ====================
  
  /**
   * Get cache information for debugging
   */
  getCacheInfo(): any {
    return {
      synthaseCache: this.synthase.getCacheStats(),
      totalScripts: this.scriptManager.listScripts().length,
      currentScript: this.currentScript,
      hasJob: !!this.currentJob
    };
  }

  /**
   * Clear all caches (for debugging)
   */
  clearAllCaches(): void {
    this.synthase.clearCache();
    this.logToConsole('🗑️ All caches cleared', 'info');
  }

  /**
   * Configure cache policy
   */
  configureCachePolicy(maxAge: number = 10 * 60 * 1000, maxSize: number = 50): void {
    this.synthase.setCachePolicy({ maxAge, maxSize });
    this.logToConsole(`⚙️ Cache policy: ${maxAge/1000}s max age, ${maxSize} max entries`, 'info');
  }
  
  // Make synthase accessible for debugging
  get synthase_debug() {
    return this.synthase;
  }
  
  // ==================== UI UPDATES ====================
  
  private updateCurrentScriptName(name: string): void {
    const element = document.getElementById('current-script-name');
    if (element) element.textContent = name;
  }
  
  private updateScriptStatus(symbol: string, className: string): void {
    const element = document.getElementById('script-status');
    if (element) {
      element.textContent = symbol;
      element.className = `text-sm ${className}`;
    }
  }
  
  private updateScriptsList(): void {
    const container = document.getElementById('scripts-list');
    if (!container) return;
    
    const scripts = this.scriptManager.listScripts().sort();
    container.innerHTML = '';
    
    scripts.forEach(script => {
      const isActive = script === this.currentScript;
      const item = document.createElement('div');
      item.className = `p-3 rounded cursor-pointer transition-colors border ${
        isActive 
          ? 'bg-blue-600 border-blue-500 text-white' 
          : 'bg-gray-700 border-gray-600 hover:bg-gray-600'
      }`;
      
      item.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium">${script}</span>
          <button class="delete-script-btn text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 text-xs" data-script="${script}">
            🗑️
          </button>
        </div>
      `;
      
      item.addEventListener('click', async () => {
        if (script !== this.currentScript) {
          await this.loadScript(script);
        }
      });
      
      // Delete button
      const deleteBtn = item.querySelector('.delete-script-btn');
      deleteBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Delete script "${script}"?`)) {
          this.scriptManager.deleteScript(script);
          if (script === this.currentScript && scripts.length > 1) {
            const remaining = scripts.filter(s => s !== script);
            await this.loadScript(remaining[0]);
          }
          this.updateScriptsList();
        }
      });
      
      container.appendChild(item);
    });
  }
  
  // ==================== CONSOLE MANAGEMENT ====================
  
  private setupConsoleLogging(): void {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.log = (...args) => {
      originalLog.apply(console, args);
      if (args[0]?.includes?.('ℹ️') || args[0]?.includes?.('INFO:')) {
        this.logToConsole(args.join(' '), 'info');
      } else if (args[0]?.includes?.('✅') || args[0]?.includes?.('SUCCESS:')) {
        this.logToConsole(args.join(' '), 'success');
      } else {
        this.logToConsole(args.join(' '), 'log');
      }
    };
    
    console.error = (...args) => {
      originalError.apply(console, args);
      this.logToConsole(args.join(' '), 'error');
    };
    
    console.warn = (...args) => {
      originalWarn.apply(console, args);
      this.logToConsole(args.join(' '), 'warn');
    };
  }
  
  private logToConsole(message: string, type: 'log' | 'info' | 'success' | 'warn' | 'error' | 'data' = 'log'): void {
    const console = document.getElementById('console-output');
    if (!console) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = `mb-1 ${this.getLogColor(type)}`;
    
    if (type === 'data') {
      div.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> <pre class="inline text-xs">${message}</pre>`;
    } else {
      div.innerHTML = `<span class="text-gray-500">[${timestamp}]</span> ${message}`;
    }
    
    console.appendChild(div);
    console.scrollTop = console.scrollHeight;
  }
  
  private getLogColor(type: string): string {
    switch (type) {
      case 'info': return 'text-blue-300';
      case 'success': return 'text-green-300';
      case 'warn': return 'text-yellow-300';
      case 'error': return 'text-red-300';
      case 'data': return 'text-gray-300';
      default: return 'text-gray-100';
    }
  }
  
  private clearConsole(): void {
    const console = document.getElementById('console-output');
    if (console) {
      console.innerHTML = '<div class="text-gray-400">Console cleared.</div>';
    }
  }
  
  private toggleConsole(): void {
    console.log('Toggle console feature - to be implemented');
  }
  
  // ==================== MODAL AND FILE OPERATIONS ====================
  
  private showNewScriptModal(): void {
    const modal = document.getElementById('new-script-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const input = document.getElementById('new-script-name') as HTMLInputElement;
      if (input) {
        input.focus();
        input.value = '';
      }
    }
  }
  
  private hideNewScriptModal(): void {
    const modal = document.getElementById('new-script-modal');
    if (modal) modal.classList.add('hidden');
  }
  
  private async createNewScript(): Promise<void> {
    const input = document.getElementById('new-script-name') as HTMLInputElement;
    if (!input) return;
    
    const name = input.value.trim();
    if (!name) {
      alert('Please enter a script name');
      return;
    }
    
    if (!name.endsWith('.js') && !name.endsWith('.synthase.js')) {
      input.value = name + '.synthase.js';
      return;
    }
    
    if (this.scriptManager.scriptExists(name)) {
      alert('Script already exists');
      return;
    }
    
    this.scriptManager.saveScript(name, NEW_SCRIPT_TEMPLATE);
    await this.loadScript(name);
    this.updateScriptsList();
    this.hideNewScriptModal();
  }
  
  private formatCurrentScript(): void {
    if (!this.editor) return;
    
    this.editor.getAction('editor.action.formatDocument').run();
    this.logToConsole('✨ Script formatted', 'info');
  }
  
  private importScript(): void {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.click();
  }
  
  private exportCurrentScript(): void {
    if (!this.editor) return;
    
    const content = this.editor.getValue();
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = this.currentScript;
    a.click();
    
    URL.revokeObjectURL(url);
    this.logToConsole(`💾 Exported: ${this.currentScript}`, 'success');
  }
  
  private async handleFileImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const content = e.target?.result as string;
      const name = file.name;
      
      this.scriptManager.saveScript(name, content);
      await this.loadScript(name);
      this.updateScriptsList();
      this.logToConsole(`📁 Imported: ${name}`, 'success');
    };
    reader.readAsText(file);
    
    input.value = '';
  }
  
  private filterScripts(query: string): void {
    const items = document.querySelectorAll('#scripts-list > div');
    items.forEach(item => {
      const text = item.textContent?.toLowerCase() || '';
      const visible = text.includes(query.toLowerCase());
      (item as HTMLElement).style.display = visible ? 'block' : 'none';
    });
  }
}