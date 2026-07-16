# DatoCMS BigCommerce entity plugin

Select and sync BigCommerce products, categories, or brands inside DatoCMS.

## What It Does

This plugin adds a manual field extension that lets editors browse BigCommerce entities and store either the storefront `id` or the numeric `entityId` in a Dato field.

Supported entity types:

- Products
- Categories
- Brands

The field extension can also keep a companion Dato string field in sync with the selected entity name, which is useful for record tables, filters, and editorial visibility.

## Plugin Configuration

At the plugin level, configure the BigCommerce connection and global defaults.

![Plugin configuration](docs/config.png)

Available settings:

- `BigCommerce storefront graphql endpoint`
  Usually `https://store-HASH.mybigcommerce.com/graphql`.
- `Storefront API authorization token`
  A Storefront GraphQL token used by the plugin to fetch entities.
- `Use products' entityId by default?`
  Sets the default stored identifier for field extensions when no field-level override is chosen.
- `Extra category root entity IDs`
  Optional comma-separated category `entityId` values. Use this when parts of your category tree need explicit traversal to appear in the selector.

The save action tests the connection before persisting settings.

## Field Extension Setup

Add the `BigCommerce Entity` manual field extension to a Dato string or integer field.

Field-level options:

- `BigCommerce entity type`
  Choose `Product`, `Category`, or `Brand`.
- `(GraphQL) Id field to use`
  Choose between:
  - `Alphanumeric (id)`
  - `Numeric (entityId)`
  - `Use global setting`
- `Companion label field API key`
  Optional sibling string field API key. When set, the plugin writes the selected entity name into that field whenever an editor selects an entity.

Notes:

- Integer fields always store `entityId`.
- String fields can store either `id` or `entityId`.

## Editor Experience

Editors can:

- Open the picker dialog from the field
- Search BigCommerce entities
- Select a product, category, or brand
- Replace an existing selection
- Clear an existing selection

The selected entity details are shown back inside the field. Products show richer storefront details, while categories and brands show the information available for those entity types.

![Entity picker preview](docs/preview.png)

## Manual Cache Refresh

Entity search results are cached in the browser for faster repeated use.

To handle changes made in BigCommerce after a cache has already been warmed:

- Each picker dialog includes a `Clear cache` button
- The action clears the cache only for the current entity type
- After clearing, the dialog refetches the latest data from BigCommerce

This is available for:

- Products
- Categories
- Brands

This avoids waiting for the 24-hour cache TTL when editors need newly created BigCommerce entities immediately.

## Local Development

Install dependencies and start the Vite dev server:

```bash
npm install
npm run dev
```

If you expose the Vite dev server through a tunnel such as ngrok, Vite will reject unknown `Host` headers unless they are explicitly allowed. This project accepts `*.ngrok-free.app` by default. To allow additional hosts, set `ALLOWED_HOSTS` as a comma-separated list before starting Vite.

Build for production:

```bash
npm run build
```

## Getting The GraphQL Endpoint

The GraphQL endpoint is typically:

```text
https://store-HASH.mybigcommerce.com/graphql
```

You can also find it in the BigCommerce dashboard under `Advanced Settings > Storefront API playground`.

## Getting The Access Token

1. Generate an API account or token with access to Storefront API tokens as required by your BigCommerce setup.
2. Create or retrieve a Storefront GraphQL authorization token.
3. Set `allowed_cors_origins` to `https://plugins-cdn.datocms.com`, since DatoCMS plugins are served from that origin.
4. Set an appropriate `expires_at` value for the token lifecycle you want.

BigCommerce references:

- https://developer.bigcommerce.com/api-docs/getting-started/authentication/rest-api-authentication#obtaining-store-api-credentials
- https://developer.bigcommerce.com/api-docs/storefront/graphql/graphql-storefront-api-overview#authentication

## Credit

This plugin was heavily inspired by:

- https://github.com/datocms/plugins/tree/master/shopify-product
