// New Synthase Script Template

export const io = {
  inputs: {
    // Define your input parameters here
    name: {
      type: 'string',
      default: 'My Script',
      description: 'Name for this operation',
      group: 'basic'
    },
    value: {
      type: 'int',
      default: 10,
      min: 1,
      max: 100,
      description: 'A numeric value to process',
      group: 'basic'
    },
    enabled: {
      type: 'boolean',
      default: true,
      description: 'Enable processing',
      group: 'settings'
    }
  },
  outputs: {
    result: {
      type: 'string',
      description: 'The processed result'
    },
    metadata: {
      type: 'object',
      description: 'Processing metadata'
    }
  }
};

export default async function myScript({ name, value, enabled }, { Logger, Utils, Calculator }) {
  Logger.info('Script starting...');
  
  if (!enabled) {
    Logger.warn('Processing disabled');
    return { 
      result: 'Processing was disabled',
      metadata: { processed: false, timestamp: new Date().toISOString() }
    };
  }
  
  // Your script logic here
  const enhancedValue = Calculator.enhance(value);
  const result = `Processed: ${name} with enhanced value ${enhancedValue}`;
  
  const metadata = {
    processed: true,
    originalValue: value,
    enhancedValue: enhancedValue,
    timestamp: new Date().toISOString(),
    processingTime: '< 1ms'
  };
  
  Logger.success('Script completed!');
  
  return { result, metadata };
}