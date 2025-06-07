// Advanced Tree Generation Script with realistic branching and multiple species

export const io = {
  inputs: {
    treeType: {
      type: 'string',
      default: 'oak',
      options: ['oak', 'birch', 'spruce', 'jungle', 'acacia', 'dark_oak', 'cherry', 'custom'],
      description: 'Type of tree to generate',
      group: 'species'
    },
    size: {
      type: 'string',
      default: 'medium',
      options: ['small', 'medium', 'large', 'giant'],
      description: 'Overall size of the tree',
      group: 'dimensions'
    },
    height: {
      type: 'int',
      default: 12,
      min: 4,
      max: 40,
      description: 'Custom height (if not using size presets)',
      group: 'dimensions'
    },
    trunkThickness: {
      type: 'int',
      default: 1,
      min: 1,
      max: 5,
      description: 'Thickness of the trunk',
      group: 'dimensions'
    },
    branching: {
      type: 'string',
      default: 'natural',
      options: ['minimal', 'natural', 'dense', 'willow'],
      description: 'Branching pattern style',
      group: 'structure'
    },
    addRoots: {
      type: 'boolean',
      default: true,
      description: 'Add visible root system',
      group: 'features'
    },
    addFruit: {
      type: 'boolean',
      default: false,
      description: 'Add fruit/special blocks to leaves',
      group: 'features'
    },
    season: {
      type: 'string',
      default: 'summer',
      options: ['spring', 'summer', 'autumn', 'winter'],
      description: 'Seasonal appearance',
      group: 'features'
    },
    customWood: {
      type: 'BlockId',
      default: 'minecraft:oak_log',
      options: [
        'minecraft:oak_log',
        'minecraft:birch_log',
        'minecraft:spruce_log',
        'minecraft:jungle_log',
        'minecraft:acacia_log',
        'minecraft:dark_oak_log'
      ],
      description: 'Custom wood type (for custom trees)',
      group: 'materials',
      dependsOn: { treeType: 'custom' }
    },
    customLeaves: {
      type: 'BlockId',
      default: 'minecraft:oak_leaves',
      options: [
        'minecraft:oak_leaves',
        'minecraft:birch_leaves',
        'minecraft:spruce_leaves',
        'minecraft:jungle_leaves',
        'minecraft:acacia_leaves',
        'minecraft:dark_oak_leaves'
      ],
      description: 'Custom leaves type (for custom trees)',
      group: 'materials',
      dependsOn: { treeType: 'custom' }
    }
  },
  outputs: {
    schematic: {
      type: 'Schematic',
      description: 'Generated tree structure'
    },
    description: {
      type: 'string',
      description: 'Tree description and characteristics'
    },
    statistics: {
      type: 'object',
      description: 'Tree generation statistics'
    }
  }
};

export default async function buildTree({ 
  treeType, size, height, trunkThickness, branching, addRoots, addFruit, season, customWood, customLeaves 
}, { Logger, Utils, Schematic }) {
  Logger.info(`Growing ${size} ${treeType} tree with ${branching} branching`);
  
  const tree = new Schematic();
  let blocksPlaced = 0;
  
  // Get tree specifications
  const specs = getTreeSpecs(treeType, size, height, trunkThickness, customWood, customLeaves);
  const materials = getSeasonalMaterials(treeType, season, specs, addFruit);
  
  // Build root system
  if (addRoots) {
    blocksPlaced += buildRoots(tree, specs, materials);
  }
  
  // Build main trunk
  blocksPlaced += buildTrunk(tree, specs, materials);
  
  // Build branches based on pattern
  blocksPlaced += buildBranches(tree, specs, materials, branching);
  
  // Add foliage
  blocksPlaced += buildFoliage(tree, specs, materials, branching, addFruit);
  
  const dimensions = tree.get_dimensions();
  const description = [
    `${size.charAt(0).toUpperCase() + size.slice(1)} ${treeType} tree`,
    `Height: ${specs.height} blocks, Trunk: ${specs.trunkThickness}x${specs.trunkThickness}`,
    `${branching} branching pattern`,
    `${season} season appearance`,
    addRoots ? 'With root system' : null,
    addFruit ? 'With fruit/flowers' : null
  ].filter(Boolean).join(', ');
  
  const statistics = {
    dimensions: `${dimensions[0]}×${dimensions[1]}×${dimensions[2]}`,
    height: specs.height,
    trunkThickness: specs.trunkThickness,
    blocksPlaced: blocksPlaced,
    treeType: treeType,
    season: season,
    branching: branching,
    materials: materials,
    hasRoots: addRoots,
    hasFruit: addFruit
  };
  
  Logger.success(`Tree grown! ${blocksPlaced} blocks placed`);
  
  return { schematic: tree, description, statistics };
}

function getTreeSpecs(treeType, size, customHeight, trunkThickness, customWood, customLeaves) {
  const sizeSpecs = {
    small: { height: 8, thickness: 1, crownRadius: 3 },
    medium: { height: 15, thickness: 1, crownRadius: 4 },
    large: { height: 25, thickness: 2, crownRadius: 6 },
    giant: { height: 35, thickness: 3, crownRadius: 8 }
  };
  
  const baseSpec = sizeSpecs[size] || sizeSpecs.medium;
  
  const treeData = {
    oak: { wood: 'minecraft:oak_log', leaves: 'minecraft:oak_leaves', branchHeight: 0.6 },
    birch: { wood: 'minecraft:birch_log', leaves: 'minecraft:birch_leaves', branchHeight: 0.7 },
    spruce: { wood: 'minecraft:spruce_log', leaves: 'minecraft:spruce_leaves', branchHeight: 0.3 },
    jungle: { wood: 'minecraft:jungle_log', leaves: 'minecraft:jungle_leaves', branchHeight: 0.5 },
    acacia: { wood: 'minecraft:acacia_log', leaves: 'minecraft:acacia_leaves', branchHeight: 0.8 },
    dark_oak: { wood: 'minecraft:dark_oak_log', leaves: 'minecraft:dark_oak_leaves', branchHeight: 0.5 },
    cherry: { wood: 'minecraft:cherry_log', leaves: 'minecraft:cherry_leaves', branchHeight: 0.7 },
    custom: { wood: customWood, leaves: customLeaves, branchHeight: 0.6 }
  };
  
  const treeInfo = treeData[treeType] || treeData.oak;
  
  return {
    height: size === 'custom' ? customHeight : baseSpec.height,
    trunkThickness: Math.max(trunkThickness, baseSpec.thickness),
    crownRadius: baseSpec.crownRadius,
    wood: treeInfo.wood,
    leaves: treeInfo.leaves,
    branchHeight: treeInfo.branchHeight,
    treeType: treeType
  };
}

function getSeasonalMaterials(treeType, season, specs, addFruit) {
  let materials = {
    wood: specs.wood,
    leaves: specs.leaves,
    roots: 'minecraft:oak_log' // Most roots are brownish
  };
  
  // Seasonal modifications
  switch (season) {
    case 'autumn':
      // Change some leaf types for autumn colors
      if (treeType === 'oak' || treeType === 'birch') {
        materials.leaves = Math.random() < 0.3 ? 'minecraft:acacia_leaves' : specs.leaves;
      }
      break;
    case 'winter':
      // Sparse leaves in winter for deciduous trees
      if (['oak', 'birch', 'cherry'].includes(treeType)) {
        materials.leafDensity = 0.3; // Much fewer leaves
      }
      break;
    case 'spring':
      // Add flowers for fruit trees
      if (addFruit && ['oak', 'cherry'].includes(treeType)) {
        materials.flowers = ['minecraft:dandelion', 'minecraft:poppy'];
      }
      break;
  }
  
  // Fruit additions
  if (addFruit) {
    switch (treeType) {
      case 'oak':
        materials.fruit = 'minecraft:brown_mushroom';
        break;
      case 'jungle':
        materials.fruit = 'minecraft:cocoa';
        break;
      case 'cherry':
        materials.fruit = 'minecraft:sweet_berries';
        break;
    }
  }
  
  return materials;
}

function buildRoots(tree, specs, materials) {
  let blocks = 0;
  const rootRadius = Math.ceil(specs.trunkThickness * 1.5);
  const centerX = Math.floor(specs.trunkThickness / 2);
  const centerZ = Math.floor(specs.trunkThickness / 2);
  
  // Surface roots
  for (let angle = 0; angle < 360; angle += 45) {
    const radians = angle * Math.PI / 180;
    const length = rootRadius + Utils.randomInt(0, 2);
    
    for (let dist = 1; dist <= length; dist++) {
      const x = centerX + Math.round(Math.cos(radians) * dist);
      const z = centerZ + Math.round(Math.sin(radians) * dist);
      const y = -Math.floor(dist / 3); // Roots go slightly underground
      
      if (Math.random() < 0.7) { // Not all root positions are filled
        tree.set_block(x, y, z, materials.roots);
        blocks++;
      }
    }
  }
  
  return blocks;
}

function buildTrunk(tree, specs, materials) {
  let blocks = 0;
  
  for (let y = 0; y < specs.height; y++) {
    const trunkRadius = specs.trunkThickness + (y < specs.height * 0.1 ? 1 : 0); // Slightly wider at base
    
    for (let x = 0; x < trunkRadius; x++) {
      for (let z = 0; z < trunkRadius; z++) {
        // Taper the trunk slightly as it goes up for large trees
        if (specs.trunkThickness > 2 && y > specs.height * 0.8) {
          const centerX = Math.floor(trunkRadius / 2);
          const centerZ = Math.floor(trunkRadius / 2);
          const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
          if (distance > specs.trunkThickness / 2) continue;
        }
        
        tree.set_block(x, y, z, materials.wood);
        blocks++;
      }
    }
  }
  
  return blocks;
}

function buildBranches(tree, specs, materials, branching) {
  let blocks = 0;
  const branchStartY = Math.floor(specs.height * specs.branchHeight);
  const branchCount = getBranchCount(branching, specs);
  
  for (let i = 0; i < branchCount; i++) {
    const branchY = branchStartY + Utils.randomInt(0, specs.height - branchStartY - 3);
    const angle = (360 / branchCount) * i + Utils.randomInt(-30, 30);
    const branchLength = getBranchLength(branching, specs);
    const branchAngleRad = angle * Math.PI / 180;
    
    // Build branch from trunk outward
    for (let dist = 1; dist <= branchLength; dist++) {
      const x = Math.floor(specs.trunkThickness / 2) + Math.round(Math.cos(branchAngleRad) * dist);
      const z = Math.floor(specs.trunkThickness / 2) + Math.round(Math.sin(branchAngleRad) * dist);
      const y = branchY + Math.floor(dist / 3); // Branches go slightly upward
      
      if (Math.random() < 0.8) { // Some randomness in branch structure
        tree.set_block(x, y, z, materials.wood);
        blocks++;
        
        // Add smaller sub-branches
        if (dist > branchLength / 2 && Math.random() < 0.3) {
          const subBranches = [
            { dx: 0, dy: 1, dz: 0 },
            { dx: 1, dy: 0, dz: 0 },
            { dx: -1, dy: 0, dz: 0 },
            { dx: 0, dy: 0, dz: 1 },
            { dx: 0, dy: 0, dz: -1 }
          ];
          
          const subBranch = subBranches[Math.floor(Math.random() * subBranches.length)];
          tree.set_block(x + subBranch.dx, y + subBranch.dy, z + subBranch.dz, materials.wood);
          blocks++;
        }
      }
    }
  }
  
  return blocks;
}

function buildFoliage(tree, specs, materials, branching, addFruit) {
  let blocks = 0;
  const crownStartY = Math.floor(specs.height * specs.branchHeight);
  const crownTopY = specs.height + Utils.randomInt(2, 5);
  const centerX = Math.floor(specs.trunkThickness / 2);
  const centerZ = Math.floor(specs.trunkThickness / 2);
  
  // Different foliage patterns based on tree type
  switch (specs.treeType) {
    case 'spruce':
      blocks += buildSpruceCanopy(tree, specs, materials, crownStartY, crownTopY, centerX, centerZ);
      break;
    case 'acacia':
      blocks += buildAcaciaCanopy(tree, specs, materials, crownStartY, crownTopY, centerX, centerZ);
      break;
    case 'willow':
      blocks += buildWillowCanopy(tree, specs, materials, crownStartY, crownTopY, centerX, centerZ);
      break;
    default:
      blocks += buildStandardCanopy(tree, specs, materials, crownStartY, crownTopY, centerX, centerZ, addFruit);
      break;
  }
  
  return blocks;
}

function buildStandardCanopy(tree, specs, materials, startY, topY, centerX, centerZ, addFruit) {
  let blocks = 0;
  
  for (let y = startY; y <= topY; y++) {
    const heightRatio = (y - startY) / (topY - startY);
    let radius = specs.crownRadius * (1 - heightRatio * 0.5); // Taper toward top
    
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let z = centerZ - radius; z <= centerZ + radius; z++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        
        if (distance <= radius && Math.random() < (materials.leafDensity || 0.8)) {
          tree.set_block(x, y, z, materials.leaves);
          blocks++;
          
          // Add fruit occasionally
          if (addFruit && materials.fruit && Math.random() < 0.05) {
            tree.set_block(x, y - 1, z, materials.fruit);
            blocks++;
          }
        }
      }
    }
  }
  
  return blocks;
}

function buildSpruceCanopy(tree, specs, materials, startY, topY, centerX, centerZ) {
  let blocks = 0;
  
  // Conical shape
  for (let y = startY; y <= topY; y++) {
    const layerRadius = Math.max(1, specs.crownRadius - (y - startY) * 0.5);
    
    for (let x = centerX - layerRadius; x <= centerX + layerRadius; x++) {
      for (let z = centerZ - layerRadius; z <= centerZ + layerRadius; z++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        
        if (distance <= layerRadius) {
          tree.set_block(x, y, z, materials.leaves);
          blocks++;
        }
      }
    }
  }
  
  return blocks;
}

function buildAcaciaCanopy(tree, specs, materials, startY, topY, centerX, centerZ) {
  let blocks = 0;
  
  // Flat-topped, umbrella-like canopy
  for (let y = topY - 3; y <= topY; y++) {
    for (let x = centerX - specs.crownRadius; x <= centerX + specs.crownRadius; x++) {
      for (let z = centerZ - specs.crownRadius; z <= centerZ + specs.crownRadius; z++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        
        if (distance <= specs.crownRadius && Math.random() < 0.9) {
          tree.set_block(x, y, z, materials.leaves);
          blocks++;
        }
      }
    }
  }
  
  return blocks;
}

function buildWillowCanopy(tree, specs, materials, startY, topY, centerX, centerZ) {
  let blocks = 0;
  
  // Drooping branches
  for (let y = startY; y <= topY; y++) {
    const radius = specs.crownRadius * (1 - (y - startY) / (topY - startY) * 0.3);
    
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let z = centerZ - radius; z <= centerZ + radius; z++) {
        const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
        
        if (distance <= radius) {
          tree.set_block(x, y, z, materials.leaves);
          blocks++;
          
          // Add drooping effect
          if (distance > radius * 0.7 && Math.random() < 0.6) {
            for (let dropY = y - 1; dropY >= y - 3 && dropY >= 1; dropY--) {
              if (Math.random() < 0.7) {
                tree.set_block(x, dropY, z, materials.leaves);
                blocks++;
              }
            }
          }
        }
      }
    }
  }
  
  return blocks;
}

function getBranchCount(branching, specs) {
  switch (branching) {
    case 'minimal': return Math.max(3, specs.trunkThickness * 2);
    case 'natural': return Math.max(6, specs.trunkThickness * 3);
    case 'dense': return Math.max(8, specs.trunkThickness * 4);
    case 'willow': return Math.max(12, specs.trunkThickness * 6);
    default: return 6;
  }
}

function getBranchLength(branching, specs) {
  const base = specs.crownRadius - 1;
  switch (branching) {
    case 'minimal': return base;
    case 'natural': return base + 1;
    case 'dense': return base + 2;
    case 'willow': return base + 3;
    default: return base + 1;
  }
}