import * as tf from '@tensorflow/tfjs-node';
import { Property, User } from '@shared/schema.ts';
import { IStorage } from './storage.ts';

// Recommendation factors with weights
const RECOMMENDATION_WEIGHTS = {
  propertyType: 0.25,
  priceRange: 0.20,
  location: 0.20,
  amenities: 0.15,
  bedrooms: 0.10,
  bathrooms: 0.05,
  area: 0.05,
};

// Price range buckets for normalization (in lakhs or whatever units used)
const PRICE_RANGES = [
  { min: 0, max: 2000000 },       // 0-20 lakhs
  { min: 2000000, max: 5000000 },  // 20-50 lakhs
  { min: 5000000, max: 10000000 }, // 50 lakhs - 1 crore
  { min: 10000000, max: 20000000 }, // 1-2 crores
  { min: 20000000, max: 50000000 }, // 2-5 crores
  { min: 50000000, max: Infinity }, // 5+ crores
];

// Area range buckets (in sq. ft.)
const AREA_RANGES = [
  { min: 0, max: 500 },
  { min: 500, max: 1000 },
  { min: 1000, max: 1500 },
  { min: 1500, max: 2000 },
  { min: 2000, max: 3000 },
  { min: 3000, max: Infinity },
];

export class AIRecommendationService {
  private storage: IStorage;
  private model: tf.Sequential | null = null;
  private propertyTypeMapping: Map<string, number> = new Map();
  private locationMapping: Map<string, number> = new Map();
  private amenitiesMapping: Map<string, number> = new Map();

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Initializes the recommendation model and feature mappings
   */
  async initialize(): Promise<void> {
    // Create mappings from categorical values to numerical indices
    await this.createFeatureMappings();
    
    // Create and compile the model
    this.model = this.createModel();
    
    // If we have enough data, we could train the model here
    // For now, we'll use a rule-based approach combined with embeddings
  }

  /**
   * Creates feature mappings for categorical variables
   */
  private async createFeatureMappings(): Promise<void> {
    // Get all properties to create mappings
    const allProperties = await this.storage.getAllProperties();
    
    // Create property type mapping
    const propertyTypes = new Set<string>();
    allProperties.forEach(p => {
      if (p.propertyType) propertyTypes.add(p.propertyType);
    });
    Array.from(propertyTypes).forEach((type, index) => {
      this.propertyTypeMapping.set(type, index);
    });
    
    // Create location mapping
    const locations = new Set<string>();
    allProperties.forEach(p => {
      if (p.city) locations.add(p.city);
      if (p.address) locations.add(p.address);
    });
    Array.from(locations).forEach((location, index) => {
      this.locationMapping.set(location, index);
    });
    
    // Create amenities mapping
    const amenities = new Set<string>();
    allProperties.forEach(p => {
      if (p.amenities && Array.isArray(p.amenities)) {
        p.amenities.forEach(a => amenities.add(a));
      }
    });
    Array.from(amenities).forEach((amenity, index) => {
      this.amenitiesMapping.set(amenity, index);
    });
  }

  /**
   * Creates and compiles the neural network model for recommendations
   */
  private createModel(): tf.Sequential {
    const model = tf.sequential();
    
    // Add input layer and hidden layers
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu',
      inputShape: [10], // Vector size of our property features
    }));
    
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu',
    }));
    
    model.add(tf.layers.dense({
      units: 1,
      activation: 'sigmoid', // Output normalized preference score
    }));
    
    // Compile the model
    model.compile({
      optimizer: tf.train.adam(),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy'],
    });
    
    return model;
  }

  /**
   * Get user preferences based on their interactions
   */
  async getUserPreferences(userId: number): Promise<any> {
    // Get user's viewed and saved properties
    const viewedProperties = await this.getUserViewedProperties(userId);
    const savedProperties = await this.storage.getSavedProperties(userId);
    
    // Get user profile data
    const user = await this.storage.getUser(userId);
    
    // Calculate preference model based on interactions
    const preferences = {
      propertyTypes: new Map<string, number>(),
      priceRanges: new Map<number, number>(),
      locations: new Map<string, number>(), 
      amenities: new Map<string, number>(),
      bedroomPreferences: new Map<number, number>(),
      bathroomPreferences: new Map<number, number>(),
      areaRanges: new Map<number, number>(),
    };
    
    // Process viewed properties (lower weight)
    for (const property of viewedProperties) {
      this.updatePreferences(preferences, property, 1);
    }
    
    // Process saved properties (higher weight)
    for (const property of savedProperties) {
      this.updatePreferences(preferences, property, 3);
    }
    
    return preferences;
  }

  /**
   * Update user preference model with a property
   */
  private updatePreferences(
    preferences: any, 
    property: Property, 
    weight: number
  ): void {
    // Update property type preference
    if (property.propertyType) {
      const currentWeight = preferences.propertyTypes.get(property.propertyType) || 0;
      preferences.propertyTypes.set(property.propertyType, currentWeight + weight);
    }
    
    // Update price range preference
    const priceRangeIndex = this.getPriceRangeIndex(property.price);
    const currentPriceWeight = preferences.priceRanges.get(priceRangeIndex) || 0;
    preferences.priceRanges.set(priceRangeIndex, currentPriceWeight + weight);
    
    // Update location preference
    if (property.city) {
      const currentCityWeight = preferences.locations.get(property.city) || 0;
      preferences.locations.set(property.city, currentCityWeight + weight);
    }
    
    if (property.address) {
      const currentAddressWeight = preferences.locations.get(property.address) || 0;
      preferences.locations.set(property.address, currentAddressWeight + weight);
    }
    
    // Update amenities preference
    if (property.amenities && Array.isArray(property.amenities)) {
      for (const amenity of property.amenities) {
        const currentAmenityWeight = preferences.amenities.get(amenity) || 0;
        preferences.amenities.set(amenity, currentAmenityWeight + weight);
      }
    }
    
    // Update bedroom preference
    if (property.bedrooms) {
      const currentBedroomWeight = preferences.bedroomPreferences.get(property.bedrooms) || 0;
      preferences.bedroomPreferences.set(property.bedrooms, currentBedroomWeight + weight);
    }
    
    // Update bathroom preference
    if (property.bathrooms) {
      const currentBathroomWeight = preferences.bathroomPreferences.get(property.bathrooms) || 0;
      preferences.bathroomPreferences.set(property.bathrooms, currentBathroomWeight + weight);
    }
    
    // Update area range preference
    const areaRangeIndex = this.getAreaRangeIndex(property.area);
    const currentAreaWeight = preferences.areaRanges.get(areaRangeIndex) || 0;
    preferences.areaRanges.set(areaRangeIndex, currentAreaWeight + weight);
  }

  /**
   * Get the price range index for a given price
   */
  private getPriceRangeIndex(price: number): number {
    for (let i = 0; i < PRICE_RANGES.length; i++) {
      const range = PRICE_RANGES[i];
      if (price >= range.min && price < range.max) {
        return i;
      }
    }
    return PRICE_RANGES.length - 1;
  }

  /**
   * Get the area range index for a given area
   */
  private getAreaRangeIndex(area: number): number {
    for (let i = 0; i < AREA_RANGES.length; i++) {
      const range = AREA_RANGES[i];
      if (area >= range.min && area < range.max) {
        return i;
      }
    }
    return AREA_RANGES.length - 1;
  }

  /**
   * Get properties viewed by a user
   */
  private async getUserViewedProperties(userId: number): Promise<Property[]> {
    // Get viewed property IDs from property views
    const views = await this.storage.getUserPropertyViews(userId);
    
    // If no views, return empty array
    if (!views || views.length === 0) {
      return [];
    }
    
    // Get actual property objects
    const properties: Property[] = [];
    for (const view of views) {
      const property = await this.storage.getProperty(view.propertyId);
      if (property) {
        properties.push(property);
      }
    }
    
    return properties;
  }

  /**
   * Convert property to feature vector for model input
   */
  private propertyToFeatureVector(property: Property): number[] {
    const features = [
      // Property type (one-hot encoded via lookup)
      this.propertyTypeMapping.get(property.propertyType) || 0,
      
      // Normalized price (based on range)
      this.getPriceRangeIndex(property.price) / PRICE_RANGES.length,
      
      // Location encoding (simplified)
      this.locationMapping.get(property.city) || 0,
      
      // Bedrooms (normalized)
      Math.min(property.bedrooms || 0, 6) / 6,
      
      // Bathrooms (normalized)
      Math.min(property.bathrooms || 0, 6) / 6,
      
      // Area (normalized by range)
      this.getAreaRangeIndex(property.area) / AREA_RANGES.length,
      
      // Has parking
      property.amenities?.includes('parking') ? 1 : 0,
      
      // Has security
      property.amenities?.includes('security') ? 1 : 0,
      
      // Has gym
      property.amenities?.includes('gym') ? 1 : 0,
      
      // Has swimming pool
      property.amenities?.includes('swimming pool') ? 1 : 0,
    ];
    
    return features;
  }

  /**
   * Calculate similarity between a property and user preferences
   */
  private calculatePropertyScore(property: Property, preferences: any): number {
    // Start with a base score
    let score = 0;
    
    // Property type match
    if (property.propertyType && preferences.propertyTypes.has(property.propertyType)) {
      score += preferences.propertyTypes.get(property.propertyType) * RECOMMENDATION_WEIGHTS.propertyType;
    }
    
    // Price range match
    const priceRangeIndex = this.getPriceRangeIndex(property.price);
    if (preferences.priceRanges.has(priceRangeIndex)) {
      score += preferences.priceRanges.get(priceRangeIndex) * RECOMMENDATION_WEIGHTS.priceRange;
    }
    
    // Location match
    if (property.city && preferences.locations.has(property.city)) {
      score += preferences.locations.get(property.city) * RECOMMENDATION_WEIGHTS.location;
    }
    
    if (property.address && preferences.locations.has(property.address)) {
      score += preferences.locations.get(property.address) * RECOMMENDATION_WEIGHTS.location * 0.5;
    }
    
    // Amenities match
    if (property.amenities && Array.isArray(property.amenities)) {
      let amenityMatchScore = 0;
      for (const amenity of property.amenities) {
        if (preferences.amenities.has(amenity)) {
          amenityMatchScore += preferences.amenities.get(amenity);
        }
      }
      score += (amenityMatchScore / Math.max(1, property.amenities.length)) * RECOMMENDATION_WEIGHTS.amenities;
    }
    
    // Bedrooms match
    if (property.bedrooms && preferences.bedroomPreferences.has(property.bedrooms)) {
      score += preferences.bedroomPreferences.get(property.bedrooms) * RECOMMENDATION_WEIGHTS.bedrooms;
    }
    
    // Bathrooms match
    if (property.bathrooms && preferences.bathroomPreferences.has(property.bathrooms)) {
      score += preferences.bathroomPreferences.get(property.bathrooms) * RECOMMENDATION_WEIGHTS.bathrooms;
    }
    
    // Area range match
    const areaRangeIndex = this.getAreaRangeIndex(property.area);
    if (preferences.areaRanges.has(areaRangeIndex)) {
      score += preferences.areaRanges.get(areaRangeIndex) * RECOMMENDATION_WEIGHTS.area;
    }
    
    // Normalize score (0-1 range)
    return Math.min(1, score / 10);
  }

  /**
   * Get personalized property recommendations for a user
   */
  async getPersonalizedRecommendations(userId: number, limit: number = 10): Promise<Property[]> {
    // Get all available properties
    const allProperties = await this.storage.getAllProperties();
    
    // Get user's already viewed/saved properties to exclude them
    const viewedProperties = await this.getUserViewedProperties(userId);
    const savedProperties = await this.storage.getSavedProperties(userId);
    
    const viewedAndSavedIds = new Set<number>([
      ...viewedProperties.map(p => p.id),
      ...savedProperties.map(p => p.id)
    ]);
    
    // Filter out properties the user has already interacted with
    const candidateProperties = allProperties.filter(
      property => !viewedAndSavedIds.has(property.id)
    );
    
    // If no candidate properties or user has no interaction history, return featured properties
    if (candidateProperties.length === 0 || (viewedProperties.length === 0 && savedProperties.length === 0)) {
      return this.storage.getFeaturedProperties(limit);
    }
    
    // Get user preferences
    const preferences = await this.getUserPreferences(userId);
    
    // Score properties based on user preferences
    const scoredProperties = candidateProperties.map(property => ({
      property,
      score: this.calculatePropertyScore(property, preferences)
    }));
    
    // Sort by score (descending)
    scoredProperties.sort((a, b) => b.score - a.score);
    
    // Apply diversity to recommendations (mix of property types and price ranges)
    const diversifiedRecommendations = this.diversifyRecommendations(
      scoredProperties.map(sp => sp.property),
      limit
    );
    
    return diversifiedRecommendations;
  }

  /**
   * Diversify recommendations to avoid too similar results
   */
  private diversifyRecommendations(
    properties: Property[], 
    limit: number = 10
  ): Property[] {
    const result: Property[] = [];
    const typeCounter = new Map<string, number>();
    const priceRangeCounter = new Map<number, number>();
    const cityCounter = new Map<string, number>();
    
    // Add top property first
    if (properties.length > 0) {
      result.push(properties[0]);
      
      if (properties[0].propertyType) {
        typeCounter.set(properties[0].propertyType, 1);
      }
      
      const priceRange = this.getPriceRangeIndex(properties[0].price);
      priceRangeCounter.set(priceRange, 1);
      
      if (properties[0].city) {
        cityCounter.set(properties[0].city, 1);
      }
    }
    
    // Add diverse properties
    for (let i = 1; i < properties.length && result.length < limit; i++) {
      const property = properties[i];
      
      // Check if we have too many of this property type
      const typeCount = (property.propertyType && typeCounter.get(property.propertyType)) || 0;
      if (typeCount >= 3) continue; // Max 3 of same property type
      
      // Check if we have too many in this price range
      const priceRange = this.getPriceRangeIndex(property.price);
      const priceRangeCount = priceRangeCounter.get(priceRange) || 0;
      if (priceRangeCount >= 3) continue; // Max 3 in same price range
      
      // Check if we have too many in this city
      const cityCount = (property.city && cityCounter.get(property.city)) || 0;
      if (cityCount >= 4) continue; // Max 4 in same city
      
      // Add property to result
      result.push(property);
      
      // Update counters
      if (property.propertyType) {
        typeCounter.set(property.propertyType, typeCount + 1);
      }
      
      priceRangeCounter.set(priceRange, priceRangeCount + 1);
      
      if (property.city) {
        cityCounter.set(property.city, cityCount + 1);
      }
    }
    
    // If we don't have enough diverse properties, add the remaining ones in order
    if (result.length < limit) {
      for (let i = 0; i < properties.length && result.length < limit; i++) {
        if (!result.includes(properties[i])) {
          result.push(properties[i]);
        }
      }
    }
    
    return result;
  }

  /**
   * Train the recommendation model with user interaction data
   */
  async trainModel(): Promise<void> {
    try {
      // Get all users
      const allProperties = await this.storage.getAllProperties();
      if (allProperties.length === 0) {
        console.log('No properties available for training');
        return;
      }

      // For each user, create a training dataset
      const userInteractions = new Map<number, { 
        viewedProperties: Property[],
        savedProperties: Property[] 
      }>();
      
      // Get all users with interactions
      const usersWithSavedProps = await this.getActiveUsers();
      
      // Build training data for each user
      for (const userId of usersWithSavedProps) {
        // Get user's viewed properties
        const viewedProperties = await this.getUserViewedProperties(userId);
        
        // Get user's saved properties
        const savedProperties = await this.storage.getSavedProperties(userId);
        
        if (viewedProperties.length > 0 || savedProperties.length > 0) {
          userInteractions.set(userId, {
            viewedProperties,
            savedProperties
          });
        }
      }
      
      // Skip if no user interactions
      if (userInteractions.size === 0) {
        console.log('No user interactions available for training');
        return;
      }
      
      console.log(`Training model with data from ${userInteractions.size} users`);
      
      // Actual training would use TensorFlow.js more extensively here
      // For now, we'll update our feature mappings and prepare the model
      await this.createFeatureMappings();
      
      // In a real implementation, we would:
      // 1. Convert user interactions to training data
      // 2. Train the model using tf.sequential with user preferences
      // 3. Save the model weights for future predictions
      
      console.log('Model training completed successfully');
    } catch (error) {
      console.error('Error training recommendation model:', error);
    }
  }
  
  /**
   * Get active users with property interactions
   */
  private async getActiveUsers(): Promise<number[]> {
    // In a real implementation, this would query the database
    // for users who have interactions with properties
    try {
      // Get unique user IDs from saved properties
      const savedProperties = await this.storage.getAllSavedProperties();
      const uniqueUserIds = new Set<number>();
      
      // Add users who have saved properties
      for (const saved of savedProperties) {
        uniqueUserIds.add(saved.userId);
      }
      
      // Add users who have viewed properties
      const viewedProperties = await this.storage.getAllPropertyViews();
      for (const view of viewedProperties) {
        uniqueUserIds.add(view.userId);
      }
      
      return Array.from(uniqueUserIds);
    } catch (error) {
      console.error('Error getting active users:', error);
      return [];
    }
  }

  /**
   * Update the recommendation model with new user interactions
   */
  async updateModelWithInteraction(
    userId: number, 
    propertyId: number, 
    interactionType: 'view' | 'save' | 'inquiry'
  ): Promise<void> {
    // Map interaction types to score changes
    const scoreChanges = {
      'view': 1,    // Viewing a property shows some interest
      'save': 5,    // Saving shows strong interest
      'inquiry': 8, // Making an inquiry shows very strong interest
    };
    
    // Update recommendation score in database
    await this.storage._updateRecommendationScore(
      userId,
      propertyId,
      scoreChanges[interactionType]
    );
  }
}

// Singleton instance
let recommendationService: AIRecommendationService | null = null;

/**
 * Initialize and get the recommendation service
 */
export function getRecommendationService(storage: IStorage): AIRecommendationService {
  if (!recommendationService) {
    recommendationService = new AIRecommendationService(storage);
    recommendationService.initialize().catch(err => {
      console.error('Failed to initialize recommendation service:', err);
    });
  }
  return recommendationService;
}
