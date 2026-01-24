import { redirect, type LoaderFunctionArgs, type ActionFunctionArgs } from 'react-router';
import { Form, useActionData } from 'react-router';
import '../styles/SlotMachine.css';

/**
 * Loader: Ensure user is logged in
 */
export async function loader({ context }: LoaderFunctionArgs) {
    const { customerAccount } = context;
    const isLoggedIn = await customerAccount.isLoggedIn();

    if (!isLoggedIn) {
        return customerAccount.login();
    }

    return null;
}

/**
 * Action: Handle preference submission and write to Shopify Metafields
 */
export async function action({ request, context }: ActionFunctionArgs) {
    const { customerAccount, env } = context;
    const formData = await request.formData();
    const categories = formData.getAll('categories');
    const acknowledged = formData.get('acknowledge') === 'on';

    if (!acknowledged) {
        return { error: 'You must acknowledge the rules to continue.' };
    }

    // 1. Get the current customer's ID
    const queryResult = await customerAccount.query<{ customer: { id: string } | null }>(`
        query CurrentCustomer {
            customer {
                id
            }
        }
    `);

    const customerId = queryResult.data?.customer?.id;
    if (!customerId) {
        return { error: 'Could not find customer profile.' };
    }

    // 2. Write Metafields via Admin API
    // NOTE: This requires SHOPIFY_ADMIN_API_ACCESS_TOKEN in your .env
    const adminToken = env.SHOPIFY_ADMIN_API_ACCESS_TOKEN || env.PRIVATE_STOREFRONT_API_TOKEN;
    const domain = env.PUBLIC_STORE_DOMAIN;

    const metafields = [
        {
            ownerId: customerId,
            key: 'favorite_categories',
            namespace: 'custom',
            type: 'json',
            value: JSON.stringify(categories)
        },
        {
            ownerId: customerId,
            key: 'understands_rules',
            namespace: 'custom',
            type: 'boolean',
            value: 'true'
        },
        {
            ownerId: customerId,
            key: 'onboarding_completed',
            namespace: 'custom',
            type: 'boolean',
            value: 'true'
        }
    ];

    try {
        const response = await fetch(`https://${domain}/admin/api/2024-01/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': adminToken,
            },
            body: JSON.stringify({
                query: METAFIELDS_SET_MUTATION,
                variables: { metafields }
            }),
        });

        const result = await response.json() as any;
        if (result.errors || result.data?.metafieldsSet?.userErrors?.length > 0) {
            console.error('[ADMIN_API] Metafield write error:', result.errors || result.data.metafieldsSet.userErrors);
            // Fallback: Proceed even if write fails for demo purposes, but log it
        }
    } catch (error) {
        console.error('[ADMIN_API] Connection failed:', error);
    }

    return redirect('/SlotMachine');
}

const METAFIELDS_SET_MUTATION = `#graphql
  mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        key
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export default function Onboarding() {
    const actionData = useActionData<typeof action>();

    const categories = [
        { id: 'gadgets', label: 'Tech & Gadgets' },
        { id: 'tools', label: 'Hardware Tools' },
        { id: 'home', label: 'Smart Home' },
        { id: 'audio', label: 'Audio Equipment' },
        { id: 'repairs', label: 'Repair Kits' }
    ];

    return (
        <div className="hacker-slots-container">
            <nav className="game-nav-bar">
                <a href="/" className="nav-link">&larr; ABORT_MISSION</a>
                <a href="https://shopify.com/71568162972/account" className="nav-link" target="_blank" rel="noopener noreferrer">MY_ACCOUNT</a>
            </nav>

            <main className="win-module onboard-card">
                <h1 className="brand-h1">SYSTEM_ONBOARDING</h1>

                <section className="onboard-section">
                    <h2 className="brand-h2 onboard-title">HOW IT WORKS</h2>
                    <ul className="onboard-list">
                        <li>&bull; <strong className="text-pink">GOLD COINS:</strong> Used for social play. No real-world value.</li>
                        <li>&bull; <strong className="text-aqua">BONUS CREDITS:</strong> Used for sweepstakes/prize entries.</li>
                        <li>&bull; <strong className="text-green">REAL PRIZES:</strong> Winning hits (Breaches) award physical Shopify products.</li>
                        <li>&bull; <strong className="text-purple">PROVABLY FAIR:</strong> Every spin is verifiable via Client Seed.</li>
                    </ul>
                </section>

                <Form method="POST" className="onboard-form">
                    <h2 className="brand-h2 onboard-title">PRIZE_PREFERENCES</h2>
                    <p className="brand-body onboard-section">
                        Select your preferred categories to bias the Logic Bridge toward items you want.
                    </p>

                    <div className="category-grid">
                        {categories.map((cat) => (
                            <label key={cat.id} className="category-label">
                                <input type="checkbox" name="categories" value={cat.id} className="category-checkbox" />
                                <span className="brand-body">{cat.label}</span>
                            </label>
                        ))}
                    </div>

                    <div className="brand-module acknowledge-container">
                        <label className="acknowledge-label">
                            <input type="checkbox" name="acknowledge" required className="acknowledge-checkbox" />
                            <span className="brand-body acknowledge-text">
                                I acknowledge that I am over 18, understand the rules, and agree that prizes are physical products, not cash. I agree to the 50% prize pool allocation model.
                            </span>
                        </label>
                    </div>

                    {actionData?.error && (
                        <p className="error-text">{actionData.error}</p>
                    )}

                    <button type="submit" className="spin-button-action full-width-action">
                        INITIALIZE_PROFILE
                    </button>
                </Form>
            </main>
        </div>
    );
}
