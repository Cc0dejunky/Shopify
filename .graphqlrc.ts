import type {IGraphQLConfig} from 'graphql-config';
import {getSchema} from '@shopify/hydrogen-codegen';

/**
 * GraphQL Config
 * @see https://the-guild.dev/graphql/config/docs/user/usage
 * @type {IGraphQLConfig}
 */
export default {
  projects: {
    default: {
      schema: getSchema('storefront'),
      documents: [
        './*.{ts,tsx,js,jsx}', // Include top-level files
        './app/routes/**/*.{ts,tsx,js,jsx}', // Include route files
        './app/components/**/*.{ts,tsx,js,jsx}', // Include component files
      ],
    },

    customer: {
      schema: getSchema('customer-account'),
      documents: ['./app/graphql/customer-account/**/*.{ts,tsx,js,jsx}'],
    },

    admin: {
      schema: getSchema('admin'),
      documents: ['./app/graphql/admin/**/*.{ts,tsx,js,jsx}'],
    },
  },
} as IGraphQLConfig;
