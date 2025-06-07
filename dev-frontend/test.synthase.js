// test.synthase.js - Simple script for testing Synthase core functionality

export const io = {
  inputs: {
    name: 'string',
    count: 'int',
    multiplier: 'float',
    enabled: 'boolean'
  },
  outputs: {
    message: 'string',
    result: 'object'
  }
};

/**
 * Simple function that processes inputs and returns formatted output
 */
export default async function simpleProcessor(
  { name, count, multiplier, enabled },     // input parameters
  { Logger, Calculator, Utils }             // generic context objects
) {
  Logger.info(`Processing request for: ${name}`);
  
  // Simple calculations
  const baseValue = count * multiplier;
  const processed = enabled ? Calculator.enhance(baseValue) : baseValue;
  
  // Use utility functions
  const formatted = Utils.formatNumber(processed, 2);
  
  // Create result object
  const result = {
    originalCount: count,
    multiplier: multiplier,
    baseValue: baseValue,
    processedValue: processed,
    formattedValue: formatted,
    wasEnabled: enabled,
    timestamp: new Date().toISOString(),
    metadata: {
      processorVersion: '1.0.0',
      executedBy: name
    }
  };
  
  // Generate response message
  const message = enabled 
    ? `Hello ${name}! Processed ${count} items with ${multiplier}x multiplier. Enhanced result: ${formatted}`
    : `Hello ${name}! Processed ${count} items with ${multiplier}x multiplier. Basic result: ${formatted}`;
  
  Logger.success(`Processing completed: ${formatted}`);
  
  // Return object matching io.outputs schema
  return { message, result };
}