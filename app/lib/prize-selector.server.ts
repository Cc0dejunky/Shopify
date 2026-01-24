/**
 * prize-selector.server.ts
 * Logic Engine for C0deNeon Sweepstakes.
 * Handles the "Logic Bridge" between pattern hits and physical prize dispensing.
 */

export interface PrizeProduct {
    id: string;
    title: string;
    poolRequired: number; // game_data.pool_required
    category: string;     // game_data.category
    interestTags: string[]; // game_data.interest_tags
    description?: string;
    value?: number;
}

/**
 * Calculates the winner based on pattern, pool balance, and customer interests.
 * @param patternHit - The win pattern detected (e.g., 'five_line_any')
 * @param currentPoolBalance - Current financial threshold
 * @param customerInterests - List of tags/types from customer order history
 * @param prizePool - Array of available prize products from Shopify
 */
export function calculateWinner(
    patternHit: string,
    currentPoolBalance: number,
    customerInterests: string[],
    prizePool: PrizeProduct[]
): PrizeProduct | null {

    // 1. FILTER BY LOGIC: Find products matching the spin pattern (logic bridge)
    // 2. FILTER BY FINANCE: Only include items where pool_required <= current pool balance
    const eligiblePrizes = prizePool.filter((prize) => {
        const matchesPattern = prize.category === patternHit;
        const canAfford = currentPoolBalance >= prize.poolRequired;
        return matchesPattern && canAfford;
    });

    if (eligiblePrizes.length === 0) {
        return null; // Fallback to a "Small Credit Win" handled outside this function
    }

    // 3. PERSONALIZATION: Match prize interest_tags to customer history
    const personalizedMatches = eligiblePrizes.filter((prize) =>
        prize.interestTags?.some((tag) => customerInterests.includes(tag))
    );

    // 4. SELECTION: 80% weight toward personalized items, 20% toward random discovery
    if (personalizedMatches.length > 0 && Math.random() < 0.8) {
        const randomIndex = Math.floor(Math.random() * personalizedMatches.length);
        return personalizedMatches[randomIndex];
    }

    // Fallback to a random eligible prize if no interest match is found or 20% random roll
    const randomIndex = Math.floor(Math.random() * eligiblePrizes.length);
    return eligiblePrizes[randomIndex];
}
