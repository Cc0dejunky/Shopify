/**
 * Smart Prize Selector
 * Personalizes prizes based on customer browsing history and purchases
 * 
 * Integration: Uses Product Metafields (game_data namespace) 
 * and matching interest_tags to customer history.
 */

import prizeConfig from '../../../prize-config.json';

export interface Prize {
    id: string;
    name: string;
    type: string;
    value: number;
    pool_required: number; // Metafield: game_data.pool_required
    category: string;      // Metafield: game_data.category
    interest_tags: string[]; // Metafield: game_data.interest_tags
    actual_cost?: number;    // Metafield: game_data.actual_cost (PRIVATE)
    description: string;
    tier: string;
    relevanceScore?: number;
}

export interface CustomerInterests {
    productTypes: Map<string, number>;
    tags: Set<string>;
}

export interface ShopifyData {
    orders?: any[];
}

export class SmartPrizeSelector {
    private customer: any;
    private shopifyData: ShopifyData;

    constructor(customer: any, shopifyData: ShopifyData) {
        this.customer = customer;
        this.shopifyData = shopifyData;
    }

    /**
     * Get personalized prize based on customer interests
     */
    async getPersonalizedPrize(prizeType: 'small' | 'medium' | 'big' | 'jackpot'): Promise<Prize> {
        const interests = await this.analyzeCustomerHistory();
        const tierPrizes = this.getPrizesByTier(prizeType);

        const scoredPrizes = tierPrizes.map(prize => ({
            ...prize,
            relevanceScore: this.calculateRelevanceScore(prize as Prize, interests)
        }));

        scoredPrizes.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
        return scoredPrizes[0] as Prize;
    }

    /**
     * Analyze customer's purchase history to find matching interest_tags
     */
    async analyzeCustomerHistory(): Promise<CustomerInterests> {
        const interests: CustomerInterests = {
            productTypes: new Map(),
            tags: new Set(),
        };

        if (this.shopifyData.orders) {
            for (const order of this.shopifyData.orders) {
                for (const item of order.lineItems) {
                    const type = item.product?.productType || item.productType;
                    if (type) {
                        interests.productTypes.set(type, (interests.productTypes.get(type) || 0) + 1);
                    }

                    // Match store categories or existing tags from orders
                    if (item.product?.tags) {
                        item.product.tags.forEach((tag: string) => interests.tags.add(tag));
                    }
                }
            }
        }

        return interests;
    }

    /**
     * Calculate relevance based on interest_tags matching customer patterns
     */
    calculateRelevanceScore(prize: Prize, interests: CustomerInterests): number {
        let score = 0;

        // 1. Exact Category Match
        if (interests.productTypes.has(prize.category)) {
            score += (interests.productTypes.get(prize.category) || 0) * 15;
        }

        // 2. Interest Tags Match (Metafield: game_data.interest_tags)
        if (prize.interest_tags) {
            prize.interest_tags.forEach(tag => {
                if (interests.tags.has(tag)) {
                    score += 20;
                }
                // Substring match for broader categories
                for (const purchasedType of interests.productTypes.keys()) {
                    if (purchasedType.toLowerCase().includes(tag.toLowerCase())) {
                        score += 10;
                    }
                }
            });
        }

        // Default noise
        if (score === 0) score = Math.random() * 5;

        return score;
    }

    /**
     * Get prizes by tier from prize-config.json
     */
    getPrizesByTier(tier: 'small' | 'medium' | 'big' | 'jackpot'): Prize[] {
        const tierMap: { [key: string]: any[] } = {
            'small': prizeConfig.prizes.filter(p => p.tier === 'small_physical' || p.tier === 'small_reward'),
            'medium': prizeConfig.prizes.filter(p => p.tier === 'medium_physical' || p.tier === 'medium_reward'),
            'big': prizeConfig.prizes.filter(p => p.tier === 'premium_physical'),
            'jackpot': prizeConfig.prizes.filter(p => p.tier === 'jackpot'),
        };

        // Note: In a production environment, these would be enriched with 
        // real product metafields from the Shopify Admin API.
        return (tierMap[tier] || []) as Prize[];
    }
}

export async function selectWinnerPrize(
    customer: any,
    prizeType: 'small' | 'medium' | 'big' | 'jackpot',
    shopifyData: ShopifyData
): Promise<Prize> {
    const selector = new SmartPrizeSelector(customer, shopifyData);
    return await selector.getPersonalizedPrize(prizeType);
}
