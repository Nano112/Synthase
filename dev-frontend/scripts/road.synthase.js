// Advanced Road and Infrastructure Building Script

export const io = {
  inputs: {
    roadType: {
      type: 'string',
      default: 'street',
      options: ['path', 'street', 'avenue', 'highway', 'bridge'],
      description: 'Type of road to build',
      group: 'design'
    },
    length: {
      type: 'int',
      default: 50,
      min: 10,
      max: 200,
      description: 'Length of the road',
      group: 'dimensions'
    },
    direction: {
      type: 'string',
      default: 'north',
      options: ['north', 'south', 'east', 'west'],
      description: 'Direction the road runs',
      group: 'layout'
    },
    addSidewalks: {
      type: 'boolean',
      default: true,
      description: 'Add sidewalks on both sides',
      group: 'features'
    },
    addStreetLights: {
      type: 'boolean',
      default: true,
      description: 'Add street lighting',
      group: 'features'
    },
    addMarkings: {
      type: 'boolean',
      default: true,
      description: 'Add road markings and lanes',
      group: 'features'
    },
    intersection: {
      type: 'string',
      default: 'none',
      options: ['none', 'crossroads', 't_junction', 'roundabout'],
      description: 'Add intersection at midpoint',
      group: 'features'
    },
    bridgeHeight: {
      type: 'int',
      default: 5,
      min: 3,
      max: 15,
      description: 'Height of bridge supports (if bridge type)',
      group: 'dimensions',
      dependsOn: { roadType: 'bridge' }
    },
    landscaping: {
      type: 'boolean',
      default: true,
      description: 'Add trees and decorative elements',
      group: 'features'
    }
  },
  outputs: {
    schematic: {
      type: 'Schematic',
      description: 'Complete road infrastructure'
    },
    description: {
      type: 'string',
      description: 'Road specifications and features'
    },
    statistics: {
      type: 'object',
      description: 'Construction statistics'
    }
  }
};

export default async function buildRoad({ 
  roadType, length, direction, addSidewalks, addStreetLights, addMarkings, intersection, bridgeHeight, landscaping 
}, { Logger, Utils, Schematic }) {
  Logger.info(`Building ${roadType} road: ${length} blocks ${direction}, intersection: ${intersection}`);
  
  const road = new Schematic();
  let blocksPlaced = 0;
  
  // Get road specifications
  const specs = getRoadSpecs(roadType, direction, bridgeHeight);
  const materials = getRoadMaterials(roadType);
  
  // Build main road surface
  blocksPlaced += buildRoadSurface(road, specs, materials, length);
  
  // Add bridge supports if bridge type
  if (roadType === 'bridge') {
    blocksPlaced += buildBridgeSupports(road, specs, materials, length, bridgeHeight);
  }
  
  // Add sidewalks
  if (addSidewalks && roadType !== 'path') {
    blocksPlaced += buildSidewalks(road, specs, materials, length);
  }
  
  // Add road markings
  if (addMarkings && ['street', 'avenue', 'highway'].includes(roadType)) {
    blocksPlaced += buildRoadMarkings(road, specs, length);
  }
  
  // Add intersection
  if (intersection !== 'none') {
    blocksPlaced += buildIntersection(road, specs, materials, intersection, length);
  }
  
  // Add street lighting
  if (addStreetLights) {
    blocksPlaced += buildStreetLights(road, specs, length, roadType);
  }
  
  // Add landscaping
  if (landscaping) {
    blocksPlaced += addLandscaping(road, specs, length, roadType);
  }
  
  const dimensions = road.get_dimensions();
  const description = [
    `${roadType.charAt(0).toUpperCase() + roadType.slice(1)} road`,
    `${length} blocks long, ${specs.width} blocks wide`,
    `Running ${direction}`,
    addSidewalks ? 'With sidewalks' : null,
    addStreetLights ? 'With street lighting' : null,
    addMarkings ? 'With lane markings' : null,
    intersection !== 'none' ? `${intersection} intersection` : null,
    landscaping ? 'With landscaping' : null
  ].filter(Boolean).join(', ');
  
  const statistics = {
    dimensions: `${dimensions[0]}×${dimensions[1]}×${dimensions[2]}`,
    roadType: roadType,
    length: length,
    width: specs.width,
    direction: direction,
    blocksPlaced: blocksPlaced,
    features: {
      sidewalks: addSidewalks,
      streetLights: addStreetLights,
      markings: addMarkings,
      intersection: intersection,
      landscaping: landscaping
    },
    materials: materials
  };
  
  Logger.success(`Road completed! ${blocksPlaced} blocks placed`);
  
  return { schematic: road, description, statistics };
}

function getRoadSpecs(roadType, direction, bridgeHeight) {
  const specs = {
    path: { width: 3, lanes: 1, elevation: 0 },
    street: { width: 7, lanes: 2, elevation: 0 },
    avenue: { width: 11, lanes: 4, elevation: 0 },
    highway: { width: 15, lanes: 6, elevation: 1 },
    bridge: { width: 9, lanes: 2, elevation: bridgeHeight }
  };
  
  const roadSpec = specs[roadType] || specs.street;
  
  return {
    ...roadSpec,
    direction: direction,
    isVertical: direction === 'north' || direction === 'south'
  };
}

function getRoadMaterials(roadType) {
  const materialSets = {
    path: {
      surface: 'minecraft:gravel',
      curb: 'minecraft:cobblestone',
      sidewalk: 'minecraft:stone_bricks',
      markings: 'minecraft:white_concrete'
    },
    street: {
      surface: 'minecraft:stone_bricks',
      curb: 'minecraft:stone',
      sidewalk: 'minecraft:smooth_stone',
      markings: 'minecraft:white_concrete'
    },
    avenue: {
      surface: 'minecraft:smooth_stone',
      curb: 'minecraft:stone_bricks',
      sidewalk: 'minecraft:quartz_block',
      markings: 'minecraft:white_concrete'
    },
    highway: {
      surface: 'minecraft:concrete',
      curb: 'minecraft:stone',
      sidewalk: 'minecraft:stone_bricks',
      markings: 'minecraft:white_concrete'
    },
    bridge: {
      surface: 'minecraft:oak_planks',
      curb: 'minecraft:oak_log',
      sidewalk: 'minecraft:oak_planks',
      markings: 'minecraft:white_concrete',
      supports: 'minecraft:stone_bricks'
    }
  };
  
  return materialSets[roadType] || materialSets.street;
}

function buildRoadSurface(road, specs, materials, length) {
  let blocks = 0;
  
  if (specs.isVertical) {
    // North-South road
    for (let z = 0; z < length; z++) {
      for (let x = 0; x < specs.width; x++) {
        road.set_block(x, specs.elevation, z, materials.surface);
        blocks++;
      }
    }
  } else {
    // East-West road
    for (let x = 0; x < length; x++) {
      for (let z = 0; z < specs.width; z++) {
        road.set_block(x, specs.elevation, z, materials.surface);
        blocks++;
      }
    }
  }
  
  return blocks;
}

function buildBridgeSupports(road, specs, materials, length, height) {
  let blocks = 0;
  const supportSpacing = 8; // Support pillar every 8 blocks
  
  for (let pos = supportSpacing; pos < length; pos += supportSpacing) {
    // Build support pillars
    for (let y = 0; y < height; y++) {
      if (specs.isVertical) {
        // Pillars on both sides
        road.set_block(0, y, pos, materials.supports);
        road.set_block(specs.width - 1, y, pos, materials.supports);
        blocks += 2;
        
        // Cross beam
        if (y === height - 1) {
          for (let x = 0; x < specs.width; x++) {
            road.set_block(x, y, pos, materials.supports);
            blocks++;
          }
        }
      } else {
        // East-West bridge
        road.set_block(pos, y, 0, materials.supports);
        road.set_block(pos, y, specs.width - 1, materials.supports);
        blocks += 2;
        
        if (y === height - 1) {
          for (let z = 0; z < specs.width; z++) {
            road.set_block(pos, y, z, materials.supports);
            blocks++;
          }
        }
      }
    }
  }
  
  return blocks;
}

function buildSidewalks(road, specs, materials, length) {
  let blocks = 0;
  const sidewalkWidth = 2;
  
  if (specs.isVertical) {
    // North-South sidewalks
    for (let z = 0; z < length; z++) {
      // Left sidewalk
      for (let x = -sidewalkWidth; x < 0; x++) {
        road.set_block(x, specs.elevation, z, materials.sidewalk);
        // Curb
        if (x === -1) {
          road.set_block(x, specs.elevation + 1, z, materials.curb);
        }
        blocks++;
      }
      
      // Right sidewalk
      for (let x = specs.width; x < specs.width + sidewalkWidth; x++) {
        road.set_block(x, specs.elevation, z, materials.sidewalk);
        // Curb
        if (x === specs.width) {
          road.set_block(x, specs.elevation + 1, z, materials.curb);
        }
        blocks++;
      }
    }
  } else {
    // East-West sidewalks
    for (let x = 0; x < length; x++) {
      // Bottom sidewalk
      for (let z = -sidewalkWidth; z < 0; z++) {
        road.set_block(x, specs.elevation, z, materials.sidewalk);
        if (z === -1) {
          road.set_block(x, specs.elevation + 1, z, materials.curb);
        }
        blocks++;
      }
      
      // Top sidewalk
      for (let z = specs.width; z < specs.width + sidewalkWidth; z++) {
        road.set_block(x, specs.elevation, z, materials.sidewalk);
        if (z === specs.width) {
          road.set_block(x, specs.elevation + 1, z, materials.curb);
        }
        blocks++;
      }
    }
  }
  
  return blocks;
}

function buildRoadMarkings(road, specs, length) {
  let blocks = 0;
  
  if (specs.lanes >= 2) {
    // Center line markings
    const centerPos = Math.floor(specs.width / 2);
    const markingSpacing = 4; // Dashed line pattern
    
    if (specs.isVertical) {
      for (let z = 0; z < length; z += markingSpacing) {
        road.set_block(centerPos, specs.elevation + 1, z, 'minecraft:white_concrete');
        blocks++;
      }
    } else {
      for (let x = 0; x < length; x += markingSpacing) {
        road.set_block(x, specs.elevation + 1, centerPos, 'minecraft:white_concrete');
        blocks++;
      }
    }
  }
  
  // Lane dividers for multi-lane roads
  if (specs.lanes >= 4) {
    const quarter = Math.floor(specs.width / 4);
    const threeQuarter = Math.floor(specs.width * 3 / 4);
    
    if (specs.isVertical) {
      for (let z = 0; z < length; z += 8) {
        road.set_block(quarter, specs.elevation + 1, z, 'minecraft:white_concrete');
        road.set_block(threeQuarter, specs.elevation + 1, z, 'minecraft:white_concrete');
        blocks += 2;
      }
    } else {
      for (let x = 0; x < length; x += 8) {
        road.set_block(x, specs.elevation + 1, quarter, 'minecraft:white_concrete');
        road.set_block(x, specs.elevation + 1, threeQuarter, 'minecraft:white_concrete');
        blocks += 2;
      }
    }
  }
  
  return blocks;
}

function buildIntersection(road, specs, materials, type, length) {
  let blocks = 0;
  const centerPos = Math.floor(length / 2);
  
  switch (type) {
    case 'crossroads':
      blocks += buildCrossroads(road, specs, materials, centerPos);
      break;
    case 't_junction':
      blocks += buildTJunction(road, specs, materials, centerPos);
      break;
    case 'roundabout':
      blocks += buildRoundabout(road, specs, materials, centerPos);
      break;
  }
  
  return blocks;
}

function buildCrossroads(road, specs, materials, centerPos) {
  let blocks = 0;
  const intersectionSize = specs.width + 4;
  
  if (specs.isVertical) {
    // Cross street (East-West)
    for (let x = -intersectionSize/2; x < intersectionSize/2; x++) {
      for (let z = centerPos - specs.width/2; z < centerPos + specs.width/2; z++) {
        road.set_block(x, specs.elevation, z, materials.surface);
        blocks++;
      }
    }
  } else {
    // Cross street (North-South)
    for (let z = -intersectionSize/2; z < intersectionSize/2; z++) {
      for (let x = centerPos - specs.width/2; x < centerPos + specs.width/2; x++) {
        road.set_block(x, specs.elevation, z, materials.surface);
        blocks++;
      }
    }
  }
  
  // Add stop lines
  const stopLinePositions = [
    { x: -1, z: centerPos - specs.width/2 - 1 },
    { x: specs.width, z: centerPos - specs.width/2 - 1 },
    { x: -1, z: centerPos + specs.width/2 },
    { x: specs.width, z: centerPos + specs.width/2 }
  ];
  
  stopLinePositions.forEach(pos => {
    road.set_block(pos.x, specs.elevation + 1, pos.z, 'minecraft:white_concrete');
    blocks++;
  });
  
  return blocks;
}

function buildTJunction(road, specs, materials, centerPos) {
  let blocks = 0;
  
  // T-junction is like half a crossroads
  if (specs.isVertical) {
    // Side street going east only
    for (let x = specs.width; x < specs.width + specs.width; x++) {
      for (let z = centerPos - specs.width/2; z < centerPos + specs.width/2; z++) {
        road.set_block(x, specs.elevation, z, materials.surface);
        blocks++;
      }
    }
  } else {
    // Side street going north only
    for (let z = specs.width; z < specs.width + specs.width; z++) {
      for (let x = centerPos - specs.width/2; x < centerPos + specs.width/2; x++) {
        road.set_block(x, specs.elevation, z, materials.surface);
        blocks++;
      }
    }
  }
  
  return blocks;
}

function buildRoundabout(road, specs, materials, centerPos) {
  let blocks = 0;
  const radius = specs.width;
  const centerX = specs.isVertical ? Math.floor(specs.width / 2) : centerPos;
  const centerZ = specs.isVertical ? centerPos : Math.floor(specs.width / 2);
  
  // Build circular road
  for (let angle = 0; angle < 360; angle += 5) {
    const radians = angle * Math.PI / 180;
    const x = centerX + Math.round(Math.cos(radians) * radius);
    const z = centerZ + Math.round(Math.sin(radians) * radius);
    
    road.set_block(x, specs.elevation, z, materials.surface);
    
    // Inner ring
    const innerX = centerX + Math.round(Math.cos(radians) * (radius - 2));
    const innerZ = centerZ + Math.round(Math.sin(radians) * (radius - 2));
    road.set_block(innerX, specs.elevation, innerZ, materials.surface);
    
    blocks += 2;
  }
  
  // Center island
  for (let x = centerX - 2; x <= centerX + 2; x++) {
    for (let z = centerZ - 2; z <= centerZ + 2; z++) {
      const distance = Math.sqrt((x - centerX) ** 2 + (z - centerZ) ** 2);
      if (distance <= 2) {
        road.set_block(x, specs.elevation + 1, z, 'minecraft:grass_block');
        // Add a small decorative tree
        if (x === centerX && z === centerZ) {
          road.set_block(x, specs.elevation + 2, z, 'minecraft:oak_log');
          road.set_block(x, specs.elevation + 3, z, 'minecraft:oak_leaves');
        }
        blocks++;
      }
    }
  }
  
  return blocks;
}

function buildStreetLights(road, specs, length, roadType) {
  let blocks = 0;
  const lightSpacing = roadType === 'highway' ? 12 : 8;
  const lightHeight = roadType === 'highway' ? 6 : 4;
  
  for (let pos = lightSpacing; pos < length; pos += lightSpacing) {
    if (specs.isVertical) {
      // Lights on both sides
      [-3, specs.width + 2].forEach(x => {
        // Light post
        for (let y = specs.elevation + 1; y <= specs.elevation + lightHeight; y++) {
          road.set_block(x, y, pos, 'minecraft:iron_bars');
          blocks++;
        }
        // Light source
        road.set_block(x, specs.elevation + lightHeight, pos, 'minecraft:glowstone');
        blocks++;
      });
    } else {
      // East-West road
      [-3, specs.width + 2].forEach(z => {
        for (let y = specs.elevation + 1; y <= specs.elevation + lightHeight; y++) {
          road.set_block(pos, y, z, 'minecraft:iron_bars');
          blocks++;
        }
        road.set_block(pos, specs.elevation + lightHeight, z, 'minecraft:glowstone');
        blocks++;
      });
    }
  }
  
  return blocks;
}

function addLandscaping(road, specs, length, roadType) {
  let blocks = 0;
  
  if (roadType === 'path' || roadType === 'street') {
    const treeSpacing = 15;
    
    for (let pos = treeSpacing; pos < length; pos += treeSpacing) {
      if (specs.isVertical) {
        // Trees beyond sidewalks
        [-5, specs.width + 4].forEach(x => {
          // Simple tree
          road.set_block(x, specs.elevation, pos, 'minecraft:grass_block');
          road.set_block(x, specs.elevation + 1, pos, 'minecraft:oak_log');
          road.set_block(x, specs.elevation + 2, pos, 'minecraft:oak_log');
          road.set_block(x, specs.elevation + 3, pos, 'minecraft:oak_leaves');
          
          // Leaves around
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.abs(dx) + Math.abs(dz) <= 1) {
                road.set_block(x + dx, specs.elevation + 3, pos + dz, 'minecraft:oak_leaves');
                blocks++;
              }
            }
          }
          
          blocks += 4;
        });
      } else {
        // East-West road landscaping
        [-5, specs.width + 4].forEach(z => {
          road.set_block(pos, specs.elevation, z, 'minecraft:grass_block');
          road.set_block(pos, specs.elevation + 1, z, 'minecraft:oak_log');
          road.set_block(pos, specs.elevation + 2, z, 'minecraft:oak_log');
          road.set_block(pos, specs.elevation + 3, z, 'minecraft:oak_leaves');
          
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              if (Math.abs(dx) + Math.abs(dz) <= 1) {
                road.set_block(pos + dx, specs.elevation + 3, z + dz, 'minecraft:oak_leaves');
                blocks++;
              }
            }
          }
          
          blocks += 4;
        });
      }
    }
  }
  
  return blocks;
}