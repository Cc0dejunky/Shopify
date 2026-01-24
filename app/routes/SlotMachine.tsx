/**
 * Hacker Slots Game Route
 * Pure Wrapper - Including Onboarding Check
 */

import { useLoaderData, redirect } from 'react-router';
import type { Route } from './+types/SlotMachine';
import SlotMachineComponent from '../components/SlotMachine';

export async function loader({ context }: Route.LoaderArgs) {
  const { customerAccount } = context;
  const isLoggedIn = await customerAccount.isLoggedIn();

  if (!isLoggedIn) {
    return {
      prizePoolBalance: 250.00,
      customer: null,
      isLoggedIn
    };
  }

  const response = await customerAccount.query(CUSTOMER_GAME_DATA_QUERY);
  const customer = (response as any).data.customer;

  // READ RULE: If onboarding isn't completed, force redirect to the onboarding flow
  const onboardingCompleted = customer?.onboarding_completed?.value === 'true';
  if (!onboardingCompleted) {
    return redirect('/account/onboarding');
  }

  return {
    prizePoolBalance: 250.00,
    customer,
    isLoggedIn
  };
}

export default function SlotMachine() {
  const { prizePoolBalance, customer, isLoggedIn } = useLoaderData<typeof loader>();

  return (
    <SlotMachineComponent
      isLoggedIn={isLoggedIn}
      poolBalance={prizePoolBalance}
      customerName={customer?.firstName}
    />
  );
}

const CUSTOMER_GAME_DATA_QUERY = `#graphql
  query getCustomerGameData {
    customer {
      firstName
      onboarding_completed: metafield(namespace: "custom", key: "onboarding_completed") {
        value
      }
    }
  }
`;
