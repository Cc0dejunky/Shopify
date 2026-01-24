import { type ActionFunctionArgs } from 'react-router';
import { calculateWinner, type PrizeProduct } from '~/lib/prize-selector.server';

const SYMBOLS = ['0', '1'];
const GRID_SIZE = 5;

interface SpinRequestBody {
  clientSeed: string;
  nonce: number;
  gameType: 'social' | 'sweep';
}

/**
 * Server-Side Spin Action
 */
export async function action({ request, context }: ActionFunctionArgs) {
  const { customerAccount, storefront } = context;

  const isLoggedIn = await customerAccount.isLoggedIn();
  const finalInterests: string[] = [];

  if (isLoggedIn) {
    const profileData = await customerAccount.query(CUSTOMER_PROFILE_QUERY);
    const customer = (profileData as any).data.customer;

    if (customer?.favorite_categories?.value) {
      try {
        const prefs = JSON.parse(customer.favorite_categories.value as string);
        if (Array.isArray(prefs)) {
          finalInterests.push(...(prefs as string[]));
        }
      } catch (e) { /* ignore parse error */ }
    }

    const orders = customer?.orders?.nodes || [];
    orders.forEach((order: any) => {
      order.lineItems.nodes.forEach((item: any) => {
        if (item.product?.productType) finalInterests.push(item.product.productType);
        if (item.product?.tags) finalInterests.push(...item.product.tags);
      });
    });
  }

  const body = (await request.json()) as SpinRequestBody;
  const { clientSeed, nonce, gameType } = body;

  const prizePoolData = await storefront.query(PRIZE_COLLECTION_QUERY);
  const prizeProducts: PrizeProduct[] = (prizePoolData as any).data.collection?.products?.nodes.map((p: any) => ({
    id: p.id,
    title: p.title,
    category: p.category?.value || 'none',
    poolRequired: parseInt(p.pool_required?.value || '0', 10),
    interestTags: JSON.parse((p.interest_tags?.value || '[]') as string),
    description: p.description,
  })) || [];

  const grid = Array(GRID_SIZE).fill(null).map(() =>
    Array(GRID_SIZE).fill(null).map(() =>
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    )
  );

  const patternHit = detectPattern(grid);
  const currentPoolBalance = 250.00;

  let winningPrize = null;
  if (patternHit !== 'none' && gameType === 'sweep') {
    winningPrize = calculateWinner(
      patternHit,
      currentPoolBalance,
      finalInterests,
      prizeProducts
    );
  }

  return new Response(JSON.stringify({
    success: true,
    grid,
    nonce,
    winningPrize: winningPrize ? {
      title: winningPrize.title,
      id: winningPrize.id,
      description: winningPrize.description,
      header: "SYSTEM BREACH: HARDWARE DETECTED"
    } : undefined,
    revealedServerSeed: 'hash-' + nonce
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

function detectPattern(grid: string[][]): string {
  const isFiveRow = checkLines(grid, 5);
  const isDiagonal = checkDiagonals(grid, 5);
  const isFourRow = checkLines(grid, 4);

  if (isDiagonal) return 'diagonal_5';
  if (isFiveRow) return 'five_line_any';
  if (isFourRow) return 'four_line_any';
  return 'none';
}

function checkLines(grid: string[][], length: number) {
  for (let r = 0; r < GRID_SIZE; r++) {
    if (hasSequence(grid[r], length)) return true;
  }
  for (let c = 0; c < GRID_SIZE; c++) {
    const col = grid.map(row => row[c]);
    if (hasSequence(col, length)) return true;
  }
  return false;
}

function checkDiagonals(grid: string[][], length: number) {
  const mainDiag = grid.map((row, i) => row[i]);
  const antiDiag = grid.map((row, i) => row[GRID_SIZE - 1 - i]);
  return hasSequence(mainDiag, length) || hasSequence(antiDiag, length);
}

function hasSequence(arr: string[], length: number) {
  let count = 1;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] === arr[i - 1]) {
      count++;
      if (count >= length) return true;
    } else {
      count = 1;
    }
  }
  return false;
}

const CUSTOMER_PROFILE_QUERY = `#graphql
  query getCustomerProfile {
    customer {
      id
      favorite_categories: metafield(namespace: "custom", key: "favorite_categories") {
        value
      }
      orders(first: 5) {
        nodes {
          lineItems(first: 5) {
            nodes {
              product {
                productType
                tags
              }
            }
          }
        }
      }
    }
  }
`;

const PRIZE_COLLECTION_QUERY = `#graphql
  query getPrizePool {
    collection(handle: "prizes") {
      products(first: 50) {
        nodes {
          id
          title
          description
          category: metafield(namespace: "game_data", key: "category") { value }
          pool_required: metafield(namespace: "game_data", key: "pool_required") { value }
          interest_tags: metafield(namespace: "game_data", key: "interest_tags") { value }
        }
      }
    }
  }
`;
