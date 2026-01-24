import { type LoaderFunctionArgs } from 'react-router';

interface CreditResponse {
    gold_coins: number;
    bonus_credits: number;
    onboarding_completed: boolean;
    favorite_categories: string[];
    understands_rules: boolean;
    customerId?: string;
    error?: string;
}

/**
 * api.customer.credits.tsx
 * Securely fetch Customer balances and Onboarding status
 */
export async function loader({ context }: LoaderFunctionArgs) {
    const { customerAccount } = context;

    const isLoggedIn = await customerAccount.isLoggedIn();

    if (!isLoggedIn) {
        const fallback: CreditResponse = {
            gold_coins: 100,
            bonus_credits: 5,
            onboarding_completed: false,
            favorite_categories: [],
            understands_rules: false
        };
        return new Response(JSON.stringify(fallback), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const response = await customerAccount.query(CUSTOMER_BALANCES_QUERY);
        const customer = (response as any).data.customer;

        if (!customer) {
            const errorResponse: CreditResponse = {
                gold_coins: 0,
                bonus_credits: 0,
                onboarding_completed: false,
                favorite_categories: [],
                understands_rules: false,
                error: 'Identity not found'
            };
            return new Response(JSON.stringify(errorResponse), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const goldCoins = parseInt(customer.gold_coins?.value || '0', 10);
        const bonusCredits = parseInt(customer.bonus_credits?.value || '0', 10);
        const onboardingCompleted = customer.onboarding_completed?.value === 'true';

        let favoriteCategories: string[] = [];
        try {
            const parsed = JSON.parse(customer.favorite_categories?.value || '[]');
            if (Array.isArray(parsed)) {
                favoriteCategories = parsed as string[];
            }
        } catch (e) {
            favoriteCategories = [];
        }

        const successResponse: CreditResponse = {
            gold_coins: goldCoins,
            bonus_credits: bonusCredits,
            onboarding_completed: onboardingCompleted,
            favorite_categories: favoriteCategories,
            understands_rules: customer.understands_rules?.value === 'true',
            customerId: customer.id
        };

        return new Response(JSON.stringify(successResponse), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('[System] Error fetching secure balances:', error);
        return new Response(JSON.stringify({ gold_coins: 0, bonus_credits: 0, error: 'Internal secure error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

const CUSTOMER_BALANCES_QUERY = `#graphql
  query getCustomerBalances {
    customer {
      id
      gold_coins: metafield(namespace: "custom", key: "gold_coins") {
        value
      }
      bonus_credits: metafield(namespace: "custom", key: "bonus_credits") {
        value
      }
      onboarding_completed: metafield(namespace: "custom", key: "onboarding_completed") {
        value
      }
      favorite_categories: metafield(namespace: "custom", key: "favorite_categories") {
        value
      }
      understands_rules: metafield(namespace: "custom", key: "understands_rules") {
        value
      }
    }
  }
`;
