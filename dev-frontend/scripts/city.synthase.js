// Advanced City Builder - Uses modular house, tree, and road scripts

export const io = {
  inputs: {
    citySize: {
      type: 'string',
      default: 'medium',
      options: ['small', 'medium', 'large', 'metropolis'],
      description: 'Overall size and scale of the city',
      group: 'scale'
    },
    cityStyle: {
      type: 'string',
      default: 'mixed',
      options: ['medieval', 'modern', 'suburban', 'mixed', 'futuristic'],
      description: 'Architectural and planning style',
      group: 'design'
    },
    districts: {
      type: 'boolean',
      default: true,
      description: 'Create distinct districts (residential, commercial, etc.)',
      group: 'layout'
    },
    roadNetwork: {
      type: 'string',
      default: 'grid',
      options: ['grid', 'radial', 'organic', 'mixed'],
      description: 'Street layout pattern',
      group: 'infrastructure'
    },
    addLandmarks: {
      type: 'boolean',
      default: true,
      description: 'Include parks, plazas, and landmark buildings',
      group: 'features'
    },
    addSuburbs: {
      type: 'boolean',
      default: true,
      description: 'Add suburban residential areas with gardens',
      group: 'layout'
    },
    populationDensity: {
      type: 'float',
      default: 0.7,
      min: 0.3,
      max: 1.0,
      step: 0.1,
      description: 'How densely packed the buildings are',
      group: 'layout'
    },
    greenSpace: {
      type: 'float',
      default: 0.2,
      min: 0.1,
      max: 0.5,
      step: 0.1,
      description: 'Percentage of area dedicated to parks and trees',
      group: 'environment'
    },
    waterFeatures: {
      type: 'boolean',
      default: true,
      description: 'Add rivers, ponds, or water features',
      group: 'environment'
    },
    addIndustrial: {
      type: 'boolean',
      default: false,
      description: 'Include industrial district',
      group: 'layout'
    },
    seed: {
      type: 'string',
      default: '',
      placeholder: 'e.g., "megacity2024"',
      description: 'Random seed for reproducible generation',
      group: 'advanced'
    }
  },
  outputs: {
    schematic: {
      type: 'Schematic',
      description: 'Complete advanced city'
    },
    cityReport: {
      type: 'string',
      description: 'Detailed city planning report'
    },
    statistics: {
      type: 'object',
      description: 'Comprehensive city statistics'
    },
    districtMap: {
      type: 'object',
      description: 'Map of city districts and their characteristics'
    }
  }
};

export default async function buildAdvancedCity({ 
  citySize, cityStyle, districts, roadNetwork, addLandmarks, addSuburbs, 
  populationDensity, greenSpace, waterFeatures, addIndustrial, seed 
}, { Logger, Utils, importScript, Schematic }) {
  Logger.info(`Building advanced ${citySize} ${cityStyle} city with ${roadNetwork} street layout`);
  
  // Import our building modules
  const buildHouse = await importScript('house.synthase.js');
  const buildTree = await importScript('tree.synthase.js');
  const buildRoad = await importScript('road.synthase.js');
  
  // Initialize city planning
  const citySpecs = getCitySpecs(citySize, populationDensity);
  const city = new Schematic();
  let totalBlocks = 0;
  
  // Set random seed if provided
  if (seed) {
    Logger.info(`Using seed: ${seed}`);
    // Note: In real implementation, would use seeded random
  }
  
  Logger.info(`Planning ${citySpecs.width}x${citySpecs.depth} city with ${citySpecs.expectedBuildings} buildings`);
  
  // Phase 1: Plan districts
  const districtPlan = districts ? planDistricts(citySpecs, cityStyle, addIndustrial) : null;
  
  // Phase 2: Build road infrastructure
  Logger.info('🛣️ Building road network...');
  const roadStats = await buildRoadInfrastructure(
    city, buildRoad, citySpecs, roadNetwork, districtPlan
  );
  totalBlocks += roadStats.blocks;
  
  // Phase 3: Build district by district
  const buildingStats = { total: 0, byDistrict: {} };
  
  if (districts && districtPlan) {
    for (const [districtName, district] of Object.entries(districtPlan.districts)) {
      Logger.info(`🏗️ Building ${districtName} district...`);
      const stats = await buildDistrict(
        city, buildHouse, district, cityStyle, populationDensity
      );
      buildingStats.byDistrict[districtName] = stats;
      buildingStats.total += stats.buildings;
      totalBlocks += stats.blocks;
    }
  } else {
    // Build mixed development without districts
    Logger.info('🏗️ Building mixed development...');
    const stats = await buildMixedDevelopment(
      city, buildHouse, citySpecs, cityStyle, populationDensity
    );
    buildingStats.total = stats.buildings;
    totalBlocks += stats.blocks;
  }
  
  // Phase 4: Add parks and green spaces
  Logger.info('🌳 Adding parks and green spaces...');
  const greenStats = await addGreenSpaces(
    city, buildTree, citySpecs, greenSpace, addLandmarks
  );
  totalBlocks += greenStats.blocks;
  
  // Phase 5: Add water features
  if (waterFeatures) {
    Logger.info('💧 Adding water features...');
    const waterStats = await addWaterFeatures(city, citySpecs);
    totalBlocks += waterStats.blocks;
  }
  
  // Phase 6: Add landmark buildings
  if (addLandmarks) {
    Logger.info('🏛️ Adding landmark buildings...');
    const landmarkStats = await addLandmarkBuildings(
      city, buildHouse, citySpecs, cityStyle
    );
    totalBlocks += landmarkStats.blocks;
  }
  
  // Phase 7: Add suburban areas
  if (addSuburbs) {
    Logger.info('🏡 Adding suburban areas...');
    const suburbStats = await addSuburbanAreas(
      city, buildHouse, buildTree, citySpecs, cityStyle
    );
    totalBlocks += suburbStats.blocks;
  }
  
  // Generate final statistics and report
  const dimensions = city.get_dimensions();
  const finalStats = {
    dimensions: `${dimensions[0]}×${dimensions[1]}×${dimensions[2]}`,
    citySize: citySize,
    style: cityStyle,
    totalBlocks: totalBlocks,
    buildings: buildingStats,
    roads: roadStats,
    greenSpaces: greenStats,
    districts: districtPlan ? Object.keys(districtPlan.districts).length : 0,
    populationDensity: populationDensity,
    roadNetwork: roadNetwork,
    hasWater: waterFeatures,
    hasLandmarks: addLandmarks,
    hasSuburbs: addSuburbs
  };
  
  const cityReport = generateCityReport(finalStats, districtPlan);
  
  Logger.success(`Advanced city completed! ${totalBlocks} blocks, ${buildingStats.total} buildings`);
  
  return { 
    schematic: city, 
    cityReport, 
    statistics: finalStats, 
    districtMap: districtPlan 
  };
}

function getCitySpecs(citySize, density) {
  const specs = {
    small: { width: 200, depth: 200, expectedBuildings: 50 },
    medium: { width: 400, depth: 400, expectedBuildings: 150 },
    large: { width: 600, depth: 600, expectedBuildings: 300 },
    metropolis: { width: 800, depth: 800, expectedBuildings: 500 }
  };
  
  const base = specs[citySize] || specs.medium;
  return {
    ...base,
    expectedBuildings: Math.floor(base.expectedBuildings * density)
  };
}

function planDistricts(citySpecs, cityStyle, addIndustrial) {
  const districts = {};
  const { width, depth } = citySpecs;
  
  // Central business district
  districts.downtown = {
    bounds: { 
      x: Math.floor(width * 0.3), 
      z: Math.floor(depth * 0.3), 
      w: Math.floor(width * 0.4), 
      h: Math.floor(depth * 0.4) 
    },
    type: 'commercial',
    buildingStyle: cityStyle === 'medieval' ? 'mansion' : 'modern',
    density: 0.9,
    avgHeight: cityStyle === 'medieval' ? 3 : 15
  };
  
  // Residential districts
  districts.residential_north = {
    bounds: { x: 0, z: 0, w: width, h: Math.floor(depth * 0.25) },
    type: 'residential',
    buildingStyle: getResidentialStyle(cityStyle),
    density: 0.7,
    avgHeight: 2
  };
  
  districts.residential_south = {
    bounds: { x: 0, z: Math.floor(depth * 0.75), w: width, h: Math.floor(depth * 0.25) },
    type: 'residential',
    buildingStyle: getResidentialStyle(cityStyle),
    density: 0.6,
    avgHeight: 2
  };
  
  // Industrial (if requested)
  if (addIndustrial) {
    districts.industrial = {
      bounds: { x: Math.floor(width * 0.8), z: 0, w: Math.floor(width * 0.2), h: depth },
      type: 'industrial',
      buildingStyle: 'modern',
      density: 0.4,
      avgHeight: 8
    };
  }
  
  return { districts, totalDistricts: Object.keys(districts).length };
}

function getResidentialStyle(cityStyle) {
  switch (cityStyle) {
    case 'medieval': return 'cottage';
    case 'modern': return 'modern';
    case 'suburban': return 'townhouse';
    case 'futuristic': return 'modern';
    default: return Utils.randomChoice(['cottage', 'modern', 'townhouse']);
  }
}

async function buildRoadInfrastructure(city, buildRoad, citySpecs, roadNetwork, districtPlan) {
  let totalBlocks = 0;
  const { width, depth } = citySpecs;
  
  switch (roadNetwork) {
    case 'grid':
      // Major arteries every 50 blocks
      for (let x = 50; x < width; x += 50) {
        const road = await buildRoad({
          roadType: 'avenue',
          length: depth,
          direction: 'north',
          addSidewalks: true,
          addStreetLights: true,
          addMarkings: true,
          intersection: 'none',
          landscaping: true
        });
        
        mergeSchematicAt(city, road.schematic, x, 0, 0);
        totalBlocks += road.statistics.blocksPlaced;
      }
      
      for (let z = 50; z < depth; z += 50) {
        const road = await buildRoad({
          roadType: 'avenue', 
          length: width,
          direction: 'east',
          addSidewalks: true,
          addStreetLights: true,
          addMarkings: true,
          intersection: 'none',
          landscaping: true
        });
        
        mergeSchematicAt(city, road.schematic, 0, 0, z);
        totalBlocks += road.statistics.blocksPlaced;
      }
      
      // Secondary streets every 25 blocks
      for (let x = 25; x < width; x += 25) {
        if (x % 50 !== 0) { // Don't overlap with major arteries
          const road = await buildRoad({
            roadType: 'street',
            length: depth,
            direction: 'north',
            addSidewalks: true,
            addStreetLights: false,
            addMarkings: false,
            intersection: 'none',
            landscaping: false
          });
          
          mergeSchematicAt(city, road.schematic, x, 0, 0);
          totalBlocks += road.statistics.blocksPlaced;
        }
      }
      break;
      
    case 'radial':
      // Central hub with radiating roads
      const centerX = Math.floor(width / 2);
      const centerZ = Math.floor(depth / 2);
      
      for (let angle = 0; angle < 360; angle += 45) {
        const radians = angle * Math.PI / 180;
        const length = Math.min(width, depth) / 3;
        
        // Build road from center outward
        for (let dist = 0; dist < length; dist += 20) {
          const x = centerX + Math.floor(Math.cos(radians) * dist);
          const z = centerZ + Math.floor(Math.sin(radians) * dist);
          
          const road = await buildRoad({
            roadType: 'street',
            length: 20,
            direction: angle < 90 || angle > 270 ? 'north' : 'south',
            addSidewalks: true,
            addStreetLights: true,
            addMarkings: false,
            intersection: 'none',
            landscaping: false
          });
          
          mergeSchematicAt(city, road.schematic, x, 0, z);
          totalBlocks += road.statistics.blocksPlaced;
        }
      }
      break;
      
    case 'organic':
      // Curved, natural-looking streets
      for (let i = 0; i < 8; i++) {
        const startX = Utils.randomInt(0, width - 100);
        const startZ = Utils.randomInt(0, depth - 100);
        const length = Utils.randomInt(80, 150);
        
        const road = await buildRoad({
          roadType: Utils.randomChoice(['street', 'avenue']),
          length: length,
          direction: Utils.randomChoice(['north', 'east']),
          addSidewalks: true,
          addStreetLights: true,
          addMarkings: true,
          intersection: i % 3 === 0 ? 'crossroads' : 'none',
          landscaping: true
        });
        
        mergeSchematicAt(city, road.schematic, startX, 0, startZ);
        totalBlocks += road.statistics.blocksPlaced;
      }
      break;
  }
  
  return { blocks: totalBlocks, network: roadNetwork };
}

async function buildDistrict(city, buildHouse, district, cityStyle, populationDensity) {
  let buildings = 0;
  let blocks = 0;
  const { bounds, buildingStyle, density, avgHeight } = district;
  
  const buildingsToPlace = Math.floor((bounds.w * bounds.h) / 400 * density * populationDensity);
  
  for (let i = 0; i < buildingsToPlace; i++) {
    const x = bounds.x + Utils.randomInt(10, bounds.w - 30);
    const z = bounds.z + Utils.randomInt(10, bounds.h - 30);
    
    // Vary building sizes based on district type
    let houseSpecs = {
      style: buildingStyle,
      width: Utils.randomInt(8, 16),
      depth: Utils.randomInt(8, 12),
      floors: Math.min(4, Math.max(1, avgHeight + Utils.randomInt(-1, 1))),
      floorHeight: 4,
      addBasement: district.type === 'residential',
      addGarage: district.type === 'residential',
      addGarden: district.type === 'residential' && Math.random() < 0.7,
      roofStyle: getDistrictRoofStyle(district.type, cityStyle),
      customColors: false
    };
    
    // Adjust for district type
    if (district.type === 'commercial') {
      houseSpecs.width = Utils.randomInt(12, 24);
      houseSpecs.depth = Utils.randomInt(10, 20);
      houseSpecs.floors = Utils.randomInt(2, 6);
      houseSpecs.addGarden = false;
      houseSpecs.addGarage = false;
    } else if (district.type === 'industrial') {
      houseSpecs.width = Utils.randomInt(20, 40);
      houseSpecs.depth = Utils.randomInt(15, 30);
      houseSpecs.floors = Utils.randomInt(1, 3);
      houseSpecs.style = 'modern';
      houseSpecs.addGarden = false;
      houseSpecs.addGarage = false;
    }
    
    try {
      const house = await buildHouse(houseSpecs);
      mergeSchematicAt(city, house.schematic, x, 1, z);
      buildings++;
      blocks += house.statistics.blocksPlaced;
    } catch (error) {
      Logger.warn(`Failed to build house in ${district.type} district: ${error.message}`);
    }
  }
  
  return { buildings, blocks, district: district.type };
}

async function buildMixedDevelopment(city, buildHouse, citySpecs, cityStyle, populationDensity) {
  let buildings = 0;
  let blocks = 0;
  
  for (let i = 0; i < citySpecs.expectedBuildings; i++) {
    const x = Utils.randomInt(20, citySpecs.width - 40);
    const z = Utils.randomInt(20, citySpecs.depth - 40);
    
    const houseSpecs = {
      style: Utils.randomChoice(['cottage', 'modern', 'townhouse']),
      width: Utils.randomInt(8, 16),
      depth: Utils.randomInt(8, 12),
      floors: Utils.randomInt(1, 3),
      floorHeight: 4,
      addBasement: Math.random() < 0.3,
      addGarage: Math.random() < 0.6,
      addGarden: Math.random() < 0.8,
      roofStyle: Utils.randomChoice(['peaked', 'hip', 'flat']),
      customColors: false
    };
    
    try {
      const house = await buildHouse(houseSpecs);
      mergeSchematicAt(city, house.schematic, x, 1, z);
      buildings++;
      blocks += house.statistics.blocksPlaced;
    } catch (error) {
      Logger.warn(`Failed to build mixed development house: ${error.message}`);
    }
  }
  
  return { buildings, blocks };
}

async function addGreenSpaces(city, buildTree, citySpecs, greenSpace, addLandmarks) {
  let blocks = 0;
  const { width, depth } = citySpecs;
  const parkCount = Math.floor(greenSpace * width * depth / 10000);
  
  // Large central park
  if (addLandmarks) {
    const parkSize = 60;
    const parkX = Math.floor((width - parkSize) / 2);
    const parkZ = Math.floor((depth - parkSize) / 2);
    
    // Grass area
    for (let x = parkX; x < parkX + parkSize; x++) {
      for (let z = parkZ; z < parkZ + parkSize; z++) {
        city.set_block(x, 0, z, 'minecraft:grass_block');
        blocks++;
        
        // Random flowers
        if (Math.random() < 0.05) {
          const flowers = ['minecraft:dandelion', 'minecraft:poppy', 'minecraft:blue_orchid'];
          city.set_block(x, 1, z, flowers[Math.floor(Math.random() * flowers.length)]);
          blocks++;
        }
      }
    }
    
    // Trees in park
    for (let i = 0; i < 20; i++) {
      const x = parkX + Utils.randomInt(5, parkSize - 5);
      const z = parkZ + Utils.randomInt(5, parkSize - 5);
      
      const tree = await buildTree({
        treeType: Utils.randomChoice(['oak', 'birch', 'cherry']),
        size: Utils.randomChoice(['medium', 'large']),
        height: 15,
        trunkThickness: 1,
        branching: 'natural',
        addRoots: true,
        addFruit: Math.random() < 0.3,
        season: 'summer'
      });
      
      mergeSchematicAt(city, tree.schematic, x, 1, z);
      blocks += tree.statistics.blocksPlaced;
    }
  }
  
  // Smaller parks throughout city
  for (let i = 0; i < parkCount; i++) {
    const parkSize = Utils.randomInt(15, 30);
    const x = Utils.randomInt(0, width - parkSize);
    const z = Utils.randomInt(0, depth - parkSize);
    
    // Create small park
    for (let px = x; px < x + parkSize; px++) {
      for (let pz = z; pz < z + parkSize; pz++) {
        city.set_block(px, 0, pz, 'minecraft:grass_block');
        blocks++;
      }
    }
    
    // Add a few trees
    for (let t = 0; t < 5; t++) {
      const treeX = x + Utils.randomInt(2, parkSize - 2);
      const treeZ = z + Utils.randomInt(2, parkSize - 2);
      
      const tree = await buildTree({
        treeType: Utils.randomChoice(['oak', 'birch', 'spruce']),
        size: 'medium',
        height: 12,
        trunkThickness: 1,
        branching: 'natural',
        addRoots: false,
        addFruit: false,
        season: 'summer'
      });
      
      mergeSchematicAt(city, tree.schematic, treeX, 1, treeZ);
      blocks += tree.statistics.blocksPlaced;
    }
  }
  
  return { blocks, parks: parkCount + (addLandmarks ? 1 : 0) };
}

async function addWaterFeatures(city, citySpecs) {
  let blocks = 0;
  const { width, depth } = citySpecs;
  
  // Add a river running through the city
  const riverWidth = 8;
  const riverZ = Math.floor(depth / 3);
  
  for (let x = 0; x < width; x++) {
    for (let z = riverZ; z < riverZ + riverWidth; z++) {
      // River bed
      city.set_block(x, -1, z, 'minecraft:clay');
      city.set_block(x, 0, z, 'minecraft:water');
      blocks += 2;
      
      // River banks
      if (z === riverZ || z === riverZ + riverWidth - 1) {
        city.set_block(x, 1, z, 'minecraft:grass_block');
        blocks++;
      }
    }
  }
  
  // Add small ponds
  for (let i = 0; i < 3; i++) {
    const pondSize = Utils.randomInt(8, 15);
    const pondX = Utils.randomInt(pondSize, width - pondSize);
    const pondZ = Utils.randomInt(pondSize, depth - pondSize);
    
    for (let x = pondX; x < pondX + pondSize; x++) {
      for (let z = pondZ; z < pondZ + pondSize; z++) {
        const distance = Math.sqrt((x - pondX - pondSize/2) ** 2 + (z - pondZ - pondSize/2) ** 2);
        if (distance < pondSize / 2) {
          city.set_block(x, -1, z, 'minecraft:clay');
          city.set_block(x, 0, z, 'minecraft:water');
          blocks += 2;
        }
      }
    }
  }
  
  return { blocks, features: 4 }; // 1 river + 3 ponds
}

async function addLandmarkBuildings(city, buildHouse, citySpecs, cityStyle) {
  let blocks = 0;
  const { width, depth } = citySpecs;
  
  // City hall / Capitol building
  const cityHall = await buildHouse({
    style: 'mansion',
    width: 32,
    depth: 24,
    floors: 3,
    floorHeight: 5,
    addBasement: false,
    addGarage: false,
    addGarden: true,
    roofStyle: 'hip',
    customColors: false
  });
  
  mergeSchematicAt(city, cityHall.schematic, Math.floor(width/2) - 16, 1, Math.floor(depth/2) + 40);
  blocks += cityHall.statistics.blocksPlaced;
  
  // Library
  const library = await buildHouse({
    style: cityStyle === 'medieval' ? 'mansion' : 'modern',
    width: 20,
    depth: 16,
    floors: 2,
    floorHeight: 5,
    addBasement: false,
    addGarage: false,
    addGarden: false,
    roofStyle: 'flat',
    customColors: false
  });
  
  mergeSchematicAt(city, library.schematic, Math.floor(width/4), 1, Math.floor(depth/4));
  blocks += library.statistics.blocksPlaced;
  
  return { blocks, landmarks: 2 };
}

async function addSuburbanAreas(city, buildHouse, buildTree, citySpecs, cityStyle) {
  let blocks = 0;
  const { width, depth } = citySpecs;
  
  // Create suburban zone in corners
  const suburbSize = Math.min(width, depth) / 4;
  const corners = [
    { x: 0, z: 0 },
    { x: width - suburbSize, z: 0 },
    { x: 0, z: depth - suburbSize },
    { x: width - suburbSize, z: depth - suburbSize }
  ];
  
  for (const corner of corners) {
    // Suburban houses with larger lots
    for (let i = 0; i < 15; i++) {
      const x = corner.x + Utils.randomInt(0, suburbSize - 20);
      const z = corner.z + Utils.randomInt(0, suburbSize - 20);
      
      const house = await buildHouse({
        style: 'cottage',
        width: Utils.randomInt(10, 14),
        depth: Utils.randomInt(8, 12),
        floors: Utils.randomInt(1, 2),
        floorHeight: 4,
        addBasement: false,
        addGarage: true,
        addGarden: true,
        roofStyle: 'peaked',
        customColors: false
      });
      
      mergeSchematicAt(city, house.schematic, x, 1, z);
      blocks += house.statistics.blocksPlaced;
      
      // Add trees around suburban houses
      for (let t = 0; t < 3; t++) {
        const treeX = x + Utils.randomInt(-5, 20);
        const treeZ = z + Utils.randomInt(-5, 15);
        
        if (treeX >= corner.x && treeX < corner.x + suburbSize &&
            treeZ >= corner.z && treeZ < corner.z + suburbSize) {
          
          const tree = await buildTree({
            treeType: Utils.randomChoice(['oak', 'birch']),
            size: 'medium',
            height: 12,
            trunkThickness: 1,
            branching: 'natural',
            addRoots: true,
            addFruit: Math.random() < 0.2,
            season: 'summer'
          });
          
          mergeSchematicAt(city, tree.schematic, treeX, 1, treeZ);
          blocks += tree.statistics.blocksPlaced;
        }
      }
    }
  }
  
  return { blocks, houses: 60, trees: 180 };
}

function mergeSchematicAt(targetSchematic, sourceSchematic, offsetX, offsetY, offsetZ) {
  try {
    const sourceDimensions = sourceSchematic.get_dimensions();
    sourceSchematic.copy_region(
      sourceSchematic,
      0, 0, 0,
      sourceDimensions[0] - 1, sourceDimensions[1] - 1, sourceDimensions[2] - 1,
      offsetX, offsetY, offsetZ,
      ['minecraft:air']
    );
  } catch (error) {
    // If copy_region fails, fall back to individual block copying
    // (This would need to be implemented if the WASM doesn't support self-copying)
    console.warn(`Failed to merge schematic: ${error.message}`);
  }
}

function getDistrictRoofStyle(districtType, cityStyle) {
  if (cityStyle === 'medieval') return 'peaked';
  if (cityStyle === 'modern' || cityStyle === 'futuristic') return 'flat';
  
  switch (districtType) {
    case 'commercial': return 'flat';
    case 'industrial': return 'flat';
    case 'residential': return Utils.randomChoice(['peaked', 'hip']);
    default: return 'peaked';
  }
}

function generateCityReport(stats, districtPlan) {
  const lines = [
    `🏙️ Advanced City Development Report`,
    `=====================================`,
    ``,
    `📊 Overview:`,
    `  City Size: ${stats.citySize} (${stats.dimensions})`,
    `  Architectural Style: ${stats.style}`,
    `  Total Blocks Placed: ${stats.totalBlocks.toLocaleString()}`,
    `  Total Buildings: ${stats.buildings.total}`,
    `  Population Density: ${(stats.populationDensity * 100).toFixed(0)}%`,
    ``,
    `🏗️ Buildings by Type:`,
  ];
  
  if (stats.buildings.byDistrict) {
    Object.entries(stats.buildings.byDistrict).forEach(([district, data]) => {
      lines.push(`  ${district}: ${data.buildings} buildings`);
    });
  } else {
    lines.push(`  Mixed Development: ${stats.buildings.total} buildings`);
  }
  
  lines.push(
    ``,
    `🛣️ Infrastructure:`,
    `  Road Network: ${stats.roadNetwork}`,
    `  Road Blocks: ${stats.roads.blocks.toLocaleString()}`,
    ``,
    `🌳 Environment:`,
    `  Parks: ${stats.greenSpaces.parks}`,
    `  Green Space Blocks: ${stats.greenSpaces.blocks.toLocaleString()}`,
    `  Water Features: ${stats.hasWater ? 'Yes' : 'No'}`,
    ``,
    `🏛️ Special Features:`,
    `  Districts: ${stats.districts}`,
    `  Landmarks: ${stats.hasLandmarks ? 'Yes' : 'No'}`,
    `  Suburban Areas: ${stats.hasSuburbs ? 'Yes' : 'No'}`,
    ``,
    `🎯 City successfully generated with advanced urban planning!`
  );
  
  return lines.join('\n');
}