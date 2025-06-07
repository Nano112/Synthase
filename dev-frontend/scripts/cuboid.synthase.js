// Enhanced Cuboid Script with comprehensive parameters

export const io = {
  inputs: {
    width: {
      type: 'int',
      default: 8,
      min: 1,
      max: 100,
      description: 'Width of the cuboid in blocks',
      group: 'dimensions'
    },
    height: {
      type: 'int', 
      default: 5,
      min: 1,
      max: 50,
      description: 'Height of the cuboid in blocks',
      group: 'dimensions'
    },
    depth: {
      type: 'int',
      default: 8,
      min: 1,
      max: 100,
      description: 'Depth of the cuboid in blocks',
      group: 'dimensions'
    },
    material: {
      type: 'BlockId',
      default: 'minecraft:stone',
      options: [
        'minecraft:stone',
        'minecraft:cobblestone',
        'minecraft:brick',
        'minecraft:oak_planks',
        'minecraft:iron_block',
        'minecraft:gold_block',
        'minecraft:diamond_block',
        'minecraft:concrete',        // Added for city script
        'minecraft:quartz_block',    // Added for city script
        'minecraft:stone_bricks'     // Added for foundations
      ],
      description: 'Primary building material',
      group: 'materials'
    },
    hollow: {
      type: 'boolean',
      default: false,
      description: 'Create a hollow cuboid (only walls)',
      group: 'structure'
    },
    wallThickness: {
      type: 'int',
      default: 1,
      min: 1,
      max: 5,
      description: 'Thickness of walls when hollow',
      group: 'structure',
      dependsOn: { hollow: true }
    },
    addFoundation: {
      type: 'boolean',
      default: false,
      description: 'Add a foundation layer below the structure',
      group: 'extras'
    },
    foundationMaterial: {
      type: 'BlockId',
      default: 'minecraft:cobblestone',
      options: [
        'minecraft:cobblestone',
        'minecraft:stone_bricks',
        'minecraft:concrete'
      ],
      description: 'Material for the foundation',
      group: 'extras',
      dependsOn: { addFoundation: true }
    }
  },
  outputs: {
    schematic: {
      type: 'Schematic',
      description: 'Generated cuboid structure (nucleation SchematicWrapper)'
    },
    volume: {
      type: 'int',
      description: 'Total volume of the structure'
    },
    description: {
      type: 'string',
      description: 'Detailed description of the generated structure'
    },
    materials: {
      type: 'object',
      description: 'Material usage breakdown'
    }
  }
};

export default async function enhancedCuboid({ 
  width, height, depth, material, hollow, wallThickness, addFoundation, foundationMaterial 
}, { Logger, Calculator, Schematic, Blocks }) {
  Logger.info(`Creating ${width}x${height}x${depth} ${hollow ? 'hollow' : 'solid'} cuboid`);
  
  // Create new schematic using real nucleation WASM
  const schematic = new Schematic();
  
  // Calculate volumes
  const totalVolume = width * height * depth;
  let solidVolume = totalVolume;
  let blocksPlaced = 0;
  
  if (hollow && width > wallThickness * 2 && depth > wallThickness * 2 && height > wallThickness) {
    // Create hollow cuboid
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          // Check if this position should have a block (walls only)
          const isWall = x < wallThickness || x >= width - wallThickness || 
                        z < wallThickness || z >= depth - wallThickness || 
                        y < wallThickness || y >= height - wallThickness;
          
          if (isWall) {
            schematic.set_block(x, y, z, material);
            blocksPlaced++;
          }
        }
      }
    }
    solidVolume = blocksPlaced;
  } else {
    // Create solid cuboid
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        for (let z = 0; z < depth; z++) {
          schematic.set_block(x, y, z, material);
          blocksPlaced++;
        }
      }
    }
    solidVolume = blocksPlaced;
  }
  
  // Add foundation if requested
  let foundationBlocks = 0;
  if (addFoundation) {
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        schematic.set_block(x, -1, z, foundationMaterial);
        foundationBlocks++;
      }
    }
  }
  
  // Material breakdown
  const materials = {
    [material]: solidVolume
  };
  
  if (addFoundation && foundationBlocks > 0) {
    materials[foundationMaterial] = foundationBlocks;
  }
  
  // Get actual dimensions and block count from the schematic
  const dimensions = schematic.get_dimensions();
  const actualBlockCount = schematic.get_block_count();
  
  const description = [
    `A ${material} ${hollow ? 'hollow ' : ''} cuboid measuring ${width}×${height}×${depth}`,
    `Dimensions: ${dimensions[0]}×${dimensions[1]}×${dimensions[2]}`,
    `Total volume: ${totalVolume} blocks`,
    `Solid volume: ${actualBlockCount} blocks`,
    hollow ? `Wall thickness: ${wallThickness} blocks` : null,
    addFoundation ? `Foundation: ${foundationMaterial} (${foundationBlocks} blocks)` : null
  ].filter(Boolean).join(', ');
  
  Logger.success(`Cuboid created! ${actualBlockCount} blocks placed`);
  
  return { 
    schematic,
    volume: actualBlockCount,
    description,
    materials
  };
}