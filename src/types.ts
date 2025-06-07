// Enhanced parameter definition
export interface ParameterDef {
  type: 'int' | 'float' | 'string' | 'boolean' | 'object' | 'array' | 'BlockId';
  default?: any;
  min?: number;
  max?: number;
  step?: number;
  options?: any[];
  itemType?: string; // For arrays
  description?: string;
  placeholder?: string;
  group?: string;
  dependsOn?: Record<string, any>; // Conditional visibility
}

export interface LoadedScript {
  id: string;
  io: IOSchema;
  deps: string[];
  defaultFunction: Function;
}

// Backward compatibility: support both string and ParameterDef
export type ParameterSpec = string | ParameterDef;

export interface IOSchema {
  inputs: Record<string, ParameterSpec>;
  outputs: Record<string, ParameterSpec>;
}

export interface Job {
  io: IOSchema;
  deps: string[];
  call(inputs: Record<string, any>): Promise<any>;
  dispose(): void;
}

// Utility functions for working with enhanced schemas
export class ParameterUtils {
  static normalize(spec: ParameterSpec): ParameterDef {
    if (typeof spec === 'string') {
      // Legacy format: just a type string
      return { type: spec as any };
    }
    return spec;
  }
  
  static getDefault(spec: ParameterSpec): any {
    const param = this.normalize(spec);
    if (param.default !== undefined) {
      return param.default;
    }
    
    // Sensible defaults based on type
    switch (param.type) {
      case 'int': return 0;
      case 'float': return 0.0;
      case 'string': return '';
      case 'boolean': return false;
      case 'object': return {};
      case 'array': return [];
      case 'BlockId': return 'minecraft:stone';
      default: return null;
    }
  }
  
  static applyDefaults(inputs: Record<string, any>, schema: Record<string, ParameterSpec>): Record<string, any> {
    const result = { ...inputs };
    
    for (const [key, spec] of Object.entries(schema)) {
      if (!(key in result)) {
        result[key] = this.getDefault(spec);
      }
    }
    
    return result;
  }
  
  static validateParameter(value: any, spec: ParameterSpec, paramName: string): void {
    const param = this.normalize(spec);
    
    // Type validation
    switch (param.type) {
      case 'int':
        if (!Number.isInteger(value)) {
          throw new Error(`${paramName} must be an integer, got: ${typeof value}`);
        }
        if (param.min !== undefined && value < param.min) {
          throw new Error(`${paramName} must be >= ${param.min}, got: ${value}`);
        }
        if (param.max !== undefined && value > param.max) {
          throw new Error(`${paramName} must be <= ${param.max}, got: ${value}`);
        }
        break;
        
      case 'float':
        if (typeof value !== 'number') {
          throw new Error(`${paramName} must be a number, got: ${typeof value}`);
        }
        if (param.min !== undefined && value < param.min) {
          throw new Error(`${paramName} must be >= ${param.min}, got: ${value}`);
        }
        if (param.max !== undefined && value > param.max) {
          throw new Error(`${paramName} must be <= ${param.max}, got: ${value}`);
        }
        break;
        
      case 'string':
        if (typeof value !== 'string') {
          throw new Error(`${paramName} must be a string, got: ${typeof value}`);
        }
        if (param.options && !param.options.includes(value)) {
          throw new Error(`${paramName} must be one of: ${param.options.join(', ')}, got: ${value}`);
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new Error(`${paramName} must be a boolean, got: ${typeof value}`);
        }
        break;
        
      case 'object':
        if (typeof value !== 'object' || value === null) {
          throw new Error(`${paramName} must be an object, got: ${typeof value}`);
        }
        break;
        
      case 'array':
        if (!Array.isArray(value)) {
          throw new Error(`${paramName} must be an array, got: ${typeof value}`);
        }
        break;
        
      case 'BlockId':
        if (typeof value !== 'string' || !value.includes(':')) {
          throw new Error(`${paramName} must be a valid BlockId (namespace:id), got: ${value}`);
        }
        if (param.options && !param.options.includes(value)) {
          throw new Error(`${paramName} must be one of: ${param.options.join(', ')}, got: ${value}`);
        }
        break;
    }
  }
  
  static shouldShowParameter(spec: ParameterSpec, allInputs: Record<string, any>): boolean {
    const param = this.normalize(spec);
    
    if (!param.dependsOn) return true;
    
    for (const [depKey, depValue] of Object.entries(param.dependsOn)) {
      if (allInputs[depKey] !== depValue) {
        return false;
      }
    }
    
    return true;
  }
  
  static groupParameters(schema: Record<string, ParameterSpec>): Record<string, string[]> {
    const groups: Record<string, string[]> = { default: [] };
    
    for (const [key, spec] of Object.entries(schema)) {
      const param = this.normalize(spec);
      const group = param.group || 'default';
      
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(key);
    }
    
    return groups;
  }
}