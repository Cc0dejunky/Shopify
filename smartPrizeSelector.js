/**
 * Smart Prize Selector
 * Personalizes prizes based on customer browsing history and purchases
 */

import prizeConfig from '../../prize-config.json';

export class SmartPrizeSelector {
  constructor(customer, shopifyData) {
    this.customer = customer;
    this.shopifyData = shopifyData;
  }

  /**
   * Get personalized prize based on customer interests
   * @param {string} prizeType - 'small', 'medium', 'big', or 'jackpot'
   * @returns {object} Prize configuration
   */
  async getPersonalizedPrize(prizeType) {
    // Get customer's browsing and purchase history
    const interests = await this.analyzeCustomerInterests();
    
    // Get available prizes for this tier
    const tierPrizes = this.getPrizesByTier(prizeType);
    
    // Score each prize based on customer interests
    const scoredPrizes = tierPrizes.map(prize => ({
      ...prize,
      relevanceScore: this.calculateRelevanceScore(prize, interests)
    }));
    
    // Return highest scoring prize
    scoredPrizes.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scoredPrizes[0];
  }

  /**
   * Analyze customer's interests from Shopify data
   */
  async analyzeCustomerInterests() {
    const interests = {
      categories: new Map(),      // Product categories browsed
      productTypes: new Map(),    // Product types purchased
      priceRange: { min: 0, max: 0 },
      brands: new Set(),
      recentSearches: [],
    };

    // Analyze past orders
    if (this.shopifyData.orders) {
      for (const order of this.shopifyData.orders) {
        for (const item of order.lineItems) {
          // Track product types
          const type = item.productType || 'general';
          interests.productTypes.set(
            type,
            (interests.productTypes.get(type) || 0) + 1
          );
          
          // Track price range
          const price = parseFloat(item.variant.price);
          if (price > interests.priceRange.max) interests.priceRange.max = price;
          if (price < interests.priceRange.min || interests.priceRange.min === 0) {
            interests.priceRange.min = price;
          }
        }
      }
    }

    // Analyze browsing history (if available)
    if (this.shopifyData.browsingHistory) {
      for (const view of this.shopifyData.browsingHistory) {
        const category = view.collection || view.productType;
        if (category) {
          interests.categories.set(
            category,
            (interests.categories.get(category) || 0) + 1
          );
        }
      }
    }

    // Analyze cart (current intent)
    if (this.shopifyData.cart) {
      for (const item of this.shopifyData.cart.lines) {
        const category = item.merchandise.product.productType;
        if (category) {
          interests.categories.set(
            category,
            (interests.categories.get(category) || 0) + 3 // Weight cart higher
          );
        }
      }
    }

    return interests;
  }

  /**
   * Calculate how relevant a prize is to the customer
   */
  calculateRelevanceScore(prize, interests) {
    let score = 0;

    // Match prize category to customer interests
    if (prize.category) {
      const categoryScore = interests.categories.get(prize.category) || 0;
      score += categoryScore * 10;
    }

    // Match prize tags to browsing history
    if (prize.tags) {
      for (const tag of prize.tags) {
        if (interests.productTypes.has(tag)) {
          score += interests.productTypes.get(tag) * 5;
        }
      }
    }

    // Boost score for accessories related to past purchases
    if (this.isAccessoryForPurchasedItem(prize, interests)) {
      score += 50; // Strong boost for complementary items
    }

    // Default score if no data (random distribution)
    if (score === 0) score = Math.random() * 10;

    return score;
  }

  /**
   * Check if prize is an accessory for something customer bought
   */
  isAccessoryForPurchasedItem(prize, interests) {
    const accessoryMap = {
      'Phone Case': ['Phone', 'iPhone', 'Samsung', 'Mobile'],
      'Screen Protector': ['Phone', 'iPhone', 'Samsung', 'Tablet', 'iPad'],
      'Charging Cable': ['Phone', 'Tablet', 'Laptop', 'AirPods'],
      'Power Bank': ['Phone', 'Tablet'],
      'Earbuds': ['Phone', 'Laptop'],
      'Phone Stand': ['Phone', 'Tablet'],
      'Laptop Sleeve': ['Laptop', 'MacBook'],
      'Mouse Pad': ['Mouse', 'Gaming', 'Laptop'],
    };

    if (!prize.accessoryFor) return false;

    const matchingTypes = accessoryMap[prize.name] || [];
    for (const type of matchingTypes) {
      for (const [purchasedType, count] of interests.productTypes) {
        if (purchasedType.toLowerCase().includes(type.toLowerCase()) && count > 0) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get prizes by tier
   */
  getPrizesByTier(tier) {
    const tierMap = {
      'small': prizeConfig.prizes.filter(p => p.tier === 'small_physical'),
      'medium': prizeConfig.prizes.filter(p => p.tier === 'medium_physical'),
      'big': prizeConfig.prizes.filter(p => p.tier === 'premium_physical'),
      'jackpot': prizeConfig.prizes.filter(p => p.tier === 'jackpot'),
    };

    return tierMap[tier] || [];
  }

  /**
   * Generate prize choice options for user selection
   */
  generatePrizeChoices(prizeType, count = 3) {
    const tierPrizes = this.getPrizesByTier(prizeType);
    
    // Randomly select 'count' prizes from tier
    const shuffled = [...tierPrizes].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }
}

/**
 * Prize Recommendation Engine
 * Example usage in your spin API:
 */
export async function selectWinnerPrize(customer, prizeType, shopifyData) {
  const selector = new SmartPrizeSelector(customer, shopifyData);
  
  // Option 1: Auto-select best match
  const personalizedPrize = await selector.getPersonalizedPrize(prizeType);
  
  // Option 2: Give user a choice of 3 relevant options
  // const choices = selector.generatePrizeChoices(prizeType, 3);
  // return choices; // Let user pick later
  
  return personalizedPrize;
}

/**
 * Example: Customer who bought a phone recently
 * 
 * Interests detected:
 * - productTypes: { 'Phone': 1, 'Electronics': 1 }
 * - Recent purchase: iPhone 15
 * 
 * Prize options:
 * 1. Screen Protector (relevance: 60) ← SELECTED (perfect match!)
 * 2. Generic USB Cable (relevance: 20)
 * 3. Random Gadget (relevance: 10)
 * 
 * Result: Customer wins exactly what they need!
 */
