export const CUSTOMER_GAME_DATA_QUERY = `#graphql
  query getCustomerGameData {
    customer {
      firstName
      onboarding_completed: metafield(namespace: "custom", key: "onboarding_completed") {
        value
      }
    }
  }
`;