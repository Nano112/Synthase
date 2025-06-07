import { ParameterUtils, type ParameterSpec, type IOSchema } from "../src";

export interface FormGeneratorOptions {
  onValueChange?: (key: string, value: any, allValues: Record<string, any>) => void;
  onSubmit?: (values: Record<string, any>) => void;
  className?: string;
}

export class FormGenerator {
  private currentValues: Record<string, any> = {};
  private container: HTMLElement;
  private options: FormGeneratorOptions;
  private schema: Record<string, ParameterSpec>;

  constructor(
    container: HTMLElement,
    schema: Record<string, ParameterSpec>,
    options: FormGeneratorOptions = {}
  ) {
    this.container = container;
    this.schema = schema;
    this.options = options;
    
    // Initialize with defaults
    this.currentValues = ParameterUtils.applyDefaults({}, schema);
    
    this.render();
  }

  /**
   * Get current form values
   */
  getValues(): Record<string, any> {
    return { ...this.currentValues };
  }

  /**
   * Set form values
   */
  setValues(values: Record<string, any>): void {
    this.currentValues = { ...this.currentValues, ...values };
    this.render();
  }

  /**
   * Render the complete form
   */
  private render(): void {
    this.container.innerHTML = '';
    
    // Group parameters
    const groups = ParameterUtils.groupParameters(this.schema);
    
    // Create form element
    const form = document.createElement('form');
    form.className = `space-y-6 ${this.options.className || ''}`;
    form.onsubmit = (e) => {
      e.preventDefault();
      this.options.onSubmit?.(this.currentValues);
    };

    // Render each group
    Object.entries(groups).forEach(([groupName, paramKeys]) => {
      if (paramKeys.length === 0) return;

      const groupContainer = document.createElement('div');
      groupContainer.className = 'space-y-4';

      // Group header (if not default)
      if (groupName !== 'default') {
        const header = document.createElement('h3');
        header.textContent = this.capitalizeFirst(groupName);
        header.className = 'text-lg font-semibold text-gray-200 border-b border-gray-600 pb-2';
        groupContainer.appendChild(header);
      }

      // Render parameters in this group
      paramKeys.forEach(key => {
        const paramElement = this.renderParameter(key, this.schema[key]);
        if (paramElement) {
          groupContainer.appendChild(paramElement);
        }
      });

      form.appendChild(groupContainer);
    });

    // Submit button if onSubmit provided
    if (this.options.onSubmit) {
      const submitContainer = document.createElement('div');
      submitContainer.className = 'pt-4 border-t border-gray-600';
      
      const submitBtn = document.createElement('button');
      submitBtn.type = 'submit';
      submitBtn.textContent = 'Run Script';
      submitBtn.className = 'w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition-colors';
      
      submitContainer.appendChild(submitBtn);
      form.appendChild(submitContainer);
    }

    this.container.appendChild(form);
  }

  /**
   * Render a single parameter input
   */
  private renderParameter(key: string, spec: ParameterSpec): HTMLElement | null {
    const param = ParameterUtils.normalize(spec);
    
    // Check conditional visibility
    if (!ParameterUtils.shouldShowParameter(spec, this.currentValues)) {
      return null;
    }

    const container = document.createElement('div');
    container.className = 'space-y-2';

    // Label
    const label = document.createElement('label');
    label.className = 'block text-sm font-medium text-gray-300';
    label.textContent = this.formatLabel(key);
    container.appendChild(label);

    // Description
    if (param.description) {
      const desc = document.createElement('p');
      desc.className = 'text-xs text-gray-400';
      desc.textContent = param.description;
      container.appendChild(desc);
    }

    // Input element
    const input = this.createInputElement(key, param);
    if (input) {
      container.appendChild(input);
    }

    return container;
  }

  /**
   * Create the appropriate input element for a parameter
   */
  private createInputElement(key: string, param: any): HTMLElement | null {
    const baseClassName = 'w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500';

    switch (param.type) {
      case 'int':
      case 'float':
        return this.createNumberInput(key, param, baseClassName);
      
      case 'string':
      case 'BlockId':
        return this.createStringInput(key, param, baseClassName);
      
      case 'boolean':
        return this.createBooleanInput(key, param);
      
      case 'array':
        return this.createArrayInput(key, param, baseClassName);
      
      case 'object':
        return this.createObjectInput(key, param, baseClassName);
      
      default:
        console.warn(`Unknown parameter type: ${param.type}`);
        return null;
    }
  }

  private createNumberInput(key: string, param: any, className: string): HTMLInputElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = className;
    input.value = String(this.currentValues[key] || param.default || 0);
    
    if (param.min !== undefined) input.min = String(param.min);
    if (param.max !== undefined) input.max = String(param.max);
    if (param.step !== undefined) input.step = String(param.step);
    
    input.addEventListener('input', () => {
      const value = param.type === 'int' ? parseInt(input.value) : parseFloat(input.value);
      this.updateValue(key, value);
    });
    
    return input;
  }

  private createStringInput(key: string, param: any, className: string): HTMLElement {
    if (param.options && param.options.length > 0) {
      // Dropdown for options
      const select = document.createElement('select');
      select.className = className;
      
      param.options.forEach((option: string) => {
        const optionEl = document.createElement('option');
        optionEl.value = option;
        optionEl.textContent = option;
        optionEl.selected = this.currentValues[key] === option;
        select.appendChild(optionEl);
      });
      
      select.addEventListener('change', () => {
        this.updateValue(key, select.value);
      });
      
      return select;
    } else {
      // Text input
      const input = document.createElement('input');
      input.type = 'text';
      input.className = className;
      input.value = String(this.currentValues[key] || param.default || '');
      input.placeholder = param.placeholder || '';
      
      input.addEventListener('input', () => {
        this.updateValue(key, input.value);
      });
      
      return input;
    }
  }

  private createBooleanInput(key: string, param: any): HTMLElement {
    const container = document.createElement('div');
    container.className = 'flex items-center space-x-2';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.className = 'rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500';
    input.checked = Boolean(this.currentValues[key]);
    
    const label = document.createElement('label');
    label.textContent = 'Enabled';
    label.className = 'text-sm text-gray-300';
    
    input.addEventListener('change', () => {
      this.updateValue(key, input.checked);
    });
    
    container.appendChild(input);
    container.appendChild(label);
    
    return container;
  }

  private createArrayInput(key: string, param: any, className: string): HTMLElement {
    const container = document.createElement('div');
    container.className = 'space-y-2';
    
    // Simple JSON textarea for now (could be enhanced)
    const textarea = document.createElement('textarea');
    textarea.className = className + ' h-24 font-mono text-sm';
    textarea.placeholder = 'Enter JSON array, e.g., ["item1", "item2"]';
    
    try {
      textarea.value = JSON.stringify(this.currentValues[key] || param.default || [], null, 2);
    } catch {
      textarea.value = '[]';
    }
    
    textarea.addEventListener('input', () => {
      try {
        const value = JSON.parse(textarea.value);
        if (Array.isArray(value)) {
          this.updateValue(key, value);
          textarea.classList.remove('border-red-500');
        } else {
          textarea.classList.add('border-red-500');
        }
      } catch {
        textarea.classList.add('border-red-500');
      }
    });
    
    container.appendChild(textarea);
    
    return container;
  }

  private createObjectInput(key: string, param: any, className: string): HTMLElement {
    const textarea = document.createElement('textarea');
    textarea.className = className + ' h-32 font-mono text-sm';
    textarea.placeholder = 'Enter JSON object, e.g., {"key": "value"}';
    
    try {
      textarea.value = JSON.stringify(this.currentValues[key] || param.default || {}, null, 2);
    } catch {
      textarea.value = '{}';
    }
    
    textarea.addEventListener('input', () => {
      try {
        const value = JSON.parse(textarea.value);
        this.updateValue(key, value);
        textarea.classList.remove('border-red-500');
      } catch {
        textarea.classList.add('border-red-500');
      }
    });
    
    return textarea;
  }

  /**
   * Update a parameter value and trigger re-render if needed
   */
  private updateValue(key: string, value: any): void {
    this.currentValues[key] = value;
    
    // Notify callback
    this.options.onValueChange?.(key, value, this.currentValues);
    
    // Check if any parameter visibility changed due to dependencies
    const needsRerender = Object.entries(this.schema).some(([paramKey, spec]) => {
      const param = ParameterUtils.normalize(spec);
      return param.dependsOn && Object.keys(param.dependsOn).includes(key);
    });
    
    if (needsRerender) {
      this.render();
    }
  }

  /**
   * Utility functions
   */
  private formatLabel(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}