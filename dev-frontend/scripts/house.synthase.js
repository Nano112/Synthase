// Enhanced House Building Script with multiple architectural styles

export const io = {
  inputs: {
    style: {
      type: 'string',
      default: 'cottage',
      options: ['cottage', 'modern', 'mansion', 'cabin', 'townhouse'],
      description: 'Architectural style of the house',
      group: 'design'
    },
    width: {
      type: 'int',
      default: 12,
      min: 6,
      max: 32,
      description: 'Width of the house',
      group: 'dimensions'
    },
    depth: {
      type: 'int',
      default: 10,
      min: 6,
      max: 32,
      description: 'Depth of the house',
      group: 'dimensions'
    },
    floors: {
      type: 'int',
      default: 2,
      min: 1,
      max: 4,
      description: 'Number of floors',
      group: 'dimensions'
    },
    floorHeight: {
      type: 'int',
      default: 4,
      min: 3,
      max: 6,
      description: 'Height of each floor',
      group: 'dimensions'
    },
    addBasement: {
      type: 'boolean',
      default: false,
      description: 'Add a basement level',
      group: 'features'
    },
    addGarage: {
      type: 'boolean',
      default: true,
      description: 'Add an attached garage',
      group: 'features'
    },
    addGarden: {
      type: 'boolean',
      default: true,
      description: 'Add a front garden area',
      group: 'features'
    },
    roofStyle: {
      type: 'string',
      default: 'peaked',
      options: ['peaked', 'flat', 'gambrel', 'hip'],
      description: 'Style of roof',
      group: 'design'
    },
    customColors: {
      type: 'boolean',
      default: false,
      description: 'Use custom color scheme',
      group: 'materials'
    }
  },
  outputs: {
    schematic: {
      type: 'Schematic',
      description: 'Complete house structure'
    },
    description: {
      type: 'string',
      description: 'House description and features'
    },
    statistics: {
      type: 'object',
      description: 'Building statistics'
    }
  }
};

export default async function buildHouse({ 
  style, width, depth, floors, floorHeight, addBasement, addGarage, addGarden, roofStyle, customColors 
}, { Logger, Utils, Schematic }) {
  Logger.info(`Building ${style} house: ${width}x${depth}, ${floors} floors`);
  
  const house = new Schematic();
  const totalHeight = floors * floorHeight + (roofStyle === 'flat' ? 1 : 3);
  let blocksPlaced = 0;
  
  // Material selection based on style
  const materials = getHouseMaterials(style, customColors);
  
  // Foundation/Basement
  const basementDepth = addBasement ? 3 : 1;
  for (let y = -basementDepth; y <= 0; y++) {
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        if (y === -basementDepth) {
          // Foundation
          house.set_block(x, y, z, materials.foundation);
          blocksPlaced++;
        } else if (addBasement && y > -basementDepth && y < 0) {
          // Basement walls
          if (x === 0 || x === width - 1 || z === 0 || z === depth - 1) {
            house.set_block(x, y, z, materials.foundation);
            blocksPlaced++;
          }
        }
      }
    }
  }
  
  // Build floors
  for (let floor = 0; floor < floors; floor++) {
    const floorY = floor * floorHeight + 1;
    blocksPlaced += buildFloor(house, floor, floorY, width, depth, floorHeight, materials, style);
  }
  
  // Build roof
  const roofY = floors * floorHeight + 1;
  blocksPlaced += buildRoof(house, roofY, width, depth, roofStyle, materials);
  
  // Add garage if requested
  let garageStats = null;
  if (addGarage) {
    garageStats = buildGarage(house, width, depth, materials);
    blocksPlaced += garageStats.blocks;
  }
  
  // Add garden if requested
  let gardenStats = null;
  if (addGarden) {
    gardenStats = buildGarden(house, width, depth);
    blocksPlaced += gardenStats.blocks;
  }
  
  // Add interior features
  blocksPlaced += addInteriorFeatures(house, width, depth, floors, floorHeight, materials, style);
  
  const dimensions = house.get_dimensions();
  const description = [
    `${style.charAt(0).toUpperCase() + style.slice(1)} house`,
    `${width}×${depth} footprint, ${floors} floors`,
    `${roofStyle} roof style`,
    addBasement ? 'With basement' : null,
    addGarage ? 'With attached garage' : null,
    addGarden ? 'With front garden' : null,
    `Materials: ${materials.walls} walls, ${materials.roof} roof`
  ].filter(Boolean).join(', ');
  
  const statistics = {
    dimensions: `${dimensions[0]}×${dimensions[1]}×${dimensions[2]}`,
    floors: floors,
    totalHeight: totalHeight,
    blocksPlaced: blocksPlaced,
    livingSpace: width * depth * floors,
    hasBasement: addBasement,
    hasGarage: addGarage,
    hasGarden: addGarden,
    style: style,
    materials: materials
  };
  
  Logger.success(`House completed! ${blocksPlaced} blocks placed`);
  
  return { schematic: house, description, statistics };
}

function getHouseMaterials(style, customColors) {
  const materialSets = {
    cottage: {
      walls: 'minecraft:cobblestone',
      roof: 'minecraft:oak_planks',
      foundation: 'minecraft:stone',
      windows: 'minecraft:glass',
      door: 'minecraft:oak_door',
      trim: 'minecraft:oak_planks',
      interior: 'minecraft:oak_planks'
    },
    modern: {
      walls: 'minecraft:concrete',
      roof: 'minecraft:stone_bricks',
      foundation: 'minecraft:stone',
      windows: 'minecraft:glass',
      door: 'minecraft:iron_door',
      trim: 'minecraft:quartz_block',
      interior: 'minecraft:quartz_block'
    },
    mansion: {
      walls: 'minecraft:stone_bricks',
      roof: 'minecraft:brick',
      foundation: 'minecraft:stone',
      windows: 'minecraft:glass',
      door: 'minecraft:oak_door',
      trim: 'minecraft:quartz_block',
      interior: 'minecraft:oak_planks'
    },
    cabin: {
      walls: 'minecraft:oak_log',
      roof: 'minecraft:oak_planks',
      foundation: 'minecraft:cobblestone',
      windows: 'minecraft:glass',
      door: 'minecraft:oak_door',
      trim: 'minecraft:oak_planks',
      interior: 'minecraft:oak_planks'
    },
    townhouse: {
      walls: 'minecraft:brick',
      roof: 'minecraft:stone_bricks',
      foundation: 'minecraft:stone',
      windows: 'minecraft:glass',
      door: 'minecraft:oak_door',
      trim: 'minecraft:stone_bricks',
      interior: 'minecraft:oak_planks'
    }
  };
  
  return materialSets[style] || materialSets.cottage;
}

function buildFloor(house, floorNum, y, width, depth, height, materials, style) {
  let blocks = 0;
  
  // Floor
  for (let x = 0; x < width; x++) {
    for (let z = 0; z < depth; z++) {
      house.set_block(x, y - 1, z, materials.interior);
      blocks++;
    }
  }
  
  // Walls
  for (let h = 0; h < height - 1; h++) {
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        if (x === 0 || x === width - 1 || z === 0 || z === depth - 1) {
          house.set_block(x, y + h, z, materials.walls);
          blocks++;
        }
      }
    }
  }
  
  // Windows (every 3-4 blocks on walls)
  for (let x = 2; x < width - 2; x += 4) {
    house.set_block(x, y + 1, 0, materials.windows); // Front windows
    house.set_block(x, y + 1, depth - 1, materials.windows); // Back windows
    blocks += 2;
  }
  
  for (let z = 2; z < depth - 2; z += 4) {
    house.set_block(0, y + 1, z, materials.windows); // Side windows
    house.set_block(width - 1, y + 1, z, materials.windows);
    blocks += 2;
  }
  
  // Front door (ground floor only)
  if (floorNum === 0) {
    const doorX = Math.floor(width / 2);
    house.set_block(doorX, y, 0, materials.door);
    house.set_block(doorX, y + 1, 0, materials.door);
    blocks += 2;
  }
  
  return blocks;
}

function buildRoof(house, y, width, depth, style, materials) {
  let blocks = 0;
  
  switch (style) {
    case 'flat':
      for (let x = 0; x < width; x++) {
        for (let z = 0; z < depth; z++) {
          house.set_block(x, y, z, materials.roof);
          blocks++;
        }
      }
      break;
      
    case 'peaked':
      const centerZ = Math.floor(depth / 2);
      for (let roofLevel = 0; roofLevel < 3; roofLevel++) {
        const roofY = y + roofLevel;
        const roofDepth = depth - roofLevel * 2;
        const startZ = roofLevel;
        
        for (let x = 0; x < width; x++) {
          for (let z = startZ; z < startZ + roofDepth; z++) {
            if (z === startZ || z === startZ + roofDepth - 1) {
              house.set_block(x, roofY, z, materials.roof);
              blocks++;
            }
          }
        }
        
        if (roofDepth <= 2) break;
      }
      break;
      
    case 'hip':
      for (let roofLevel = 0; roofLevel < 3; roofLevel++) {
        const roofY = y + roofLevel;
        const roofWidth = width - roofLevel * 2;
        const roofDepth = depth - roofLevel * 2;
        const startX = roofLevel;
        const startZ = roofLevel;
        
        for (let x = startX; x < startX + roofWidth; x++) {
          for (let z = startZ; z < startZ + roofDepth; z++) {
            if (x === startX || x === startX + roofWidth - 1 || 
                z === startZ || z === startZ + roofDepth - 1) {
              house.set_block(x, roofY, z, materials.roof);
              blocks++;
            }
          }
        }
        
        if (roofWidth <= 2 || roofDepth <= 2) break;
      }
      break;
  }
  
  return blocks;
}

function buildGarage(house, houseWidth, houseDepth, materials) {
  const garageWidth = 6;
  const garageDepth = 8;
  const garageHeight = 3;
  let blocks = 0;
  
  // Position garage to the side
  const garageX = houseWidth + 1;
  const garageZ = 0;
  
  // Garage foundation
  for (let x = garageX; x < garageX + garageWidth; x++) {
    for (let z = garageZ; z < garageZ + garageDepth; z++) {
      house.set_block(x, 0, z, materials.foundation);
      blocks++;
    }
  }
  
  // Garage walls
  for (let h = 1; h <= garageHeight; h++) {
    for (let x = garageX; x < garageX + garageWidth; x++) {
      for (let z = garageZ; z < garageZ + garageDepth; z++) {
        if (x === garageX || x === garageX + garageWidth - 1 || 
            z === garageZ || z === garageZ + garageDepth - 1) {
          house.set_block(x, h, z, materials.walls);
          blocks++;
        }
      }
    }
  }
  
  // Garage door
  const doorX = garageX + Math.floor(garageWidth / 2);
  house.set_block(doorX, 1, garageZ, 'minecraft:air');
  house.set_block(doorX, 2, garageZ, 'minecraft:air');
  house.set_block(doorX - 1, 1, garageZ, 'minecraft:air');
  house.set_block(doorX - 1, 2, garageZ, 'minecraft:air');
  
  // Garage roof
  for (let x = garageX; x < garageX + garageWidth; x++) {
    for (let z = garageZ; z < garageZ + garageDepth; z++) {
      house.set_block(x, garageHeight + 1, z, materials.roof);
      blocks++;
    }
  }
  
  return { blocks, dimensions: `${garageWidth}x${garageDepth}` };
}

function buildGarden(house, houseWidth, houseDepth) {
  let blocks = 0;
  
  // Front garden area
  const gardenDepth = 6;
  for (let x = -2; x < houseWidth + 2; x++) {
    for (let z = -gardenDepth; z < 0; z++) {
      // Grass blocks
      house.set_block(x, 0, z, 'minecraft:grass_block');
      blocks++;
      
      // Some flowers
      if (Math.random() < 0.1) {
        const flowers = ['minecraft:dandelion', 'minecraft:poppy', 'minecraft:blue_orchid'];
        house.set_block(x, 1, z, flowers[Math.floor(Math.random() * flowers.length)]);
        blocks++;
      }
    }
  }
  
  // Garden path
  const pathX = Math.floor(houseWidth / 2);
  for (let z = -gardenDepth; z < 0; z++) {
    house.set_block(pathX, 0, z, 'minecraft:stone_bricks');
    blocks++;
  }
  
  return { blocks, area: (houseWidth + 4) * gardenDepth };
}

function addInteriorFeatures(house, width, depth, floors, floorHeight, materials, style) {
  let blocks = 0;
  
  // Add some basic interior walls and features
  for (let floor = 0; floor < floors; floor++) {
    const y = floor * floorHeight + 1;
    
    // Central hallway
    const hallwayX = Math.floor(width / 2);
    for (let z = 1; z < depth - 1; z++) {
      // Make sure hallway is clear
      for (let h = 0; h < floorHeight - 1; h++) {
        house.set_block(hallwayX, y + h, z, 'minecraft:air');
      }
    }
    
    // Room dividers
    if (width > 8) {
      const dividerX = Math.floor(width / 3);
      for (let z = 1; z < depth - 1; z += 2) {
        house.set_block(dividerX, y, z, materials.interior);
        house.set_block(dividerX, y + 1, z, materials.interior);
        blocks += 2;
      }
    }
    
    // Stairs (if multiple floors)
    if (floors > 1 && floor < floors - 1) {
      const stairX = width - 2;
      const stairZ = depth - 2;
      for (let h = 0; h < floorHeight; h++) {
        house.set_block(stairX, y + h, stairZ, 'minecraft:oak_stairs');
        blocks++;
      }
    }
  }
  
  return blocks;
}