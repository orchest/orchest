# Front-end

## Style Guide

### React.js

- TypeScript
  - **All** new `.js` files should have `// @ts-check` enabled.
- Component design
  - **Don't** use class components
  - **Do** use functional components
- Sharing state and logic
  - **Avoid** using `window` variables
  - **Avoid** using `ref` to access state from other components
  - **Avoid** ["prop drilling"](https://kentcdodds.com/blog/prop-drilling)
  - **Do** make use of [context-driven hooks](https://reactjs.org/docs/hooks-reference.html#usecontext)

## Project-specific Details

### `orchest-webserver`

#### `useOrchest()`

When sharing global logic/state, make the most of the `useOrchest` hook [(See #214)](https://github.com/orchest/orchest/pull/214)

```js
const {
  // Globally-accessed state
  state,
  // Actions to modify the globally-accessed state
  dispatch,
  // Helpers to filter/find specific areas of the state (e.g. a specific session)
  get,
} = useOrchest();
```

Under-the-hood, `useOrchest` uses [`React.useReducer()`](https://reactjs.org/docs/hooks-reference.html#usereducer) to handle state, with a private `SessionProvider` (which fetches/updates sessions via [SWR](https://swr.vercel.app/)).

It can be consumed in a functional component like so:

```js
// @ts-check
import React from "react";
import { useOrchest } from "@/hooks/orchest";

const SessionsListFC = () => {
  const { state, dispatch } = useOrchest();

  return (
    // <your-component>
  );
};
```

## Ongoing Migrations

We can't spend a lot of time refactoring, but we can implement changes incrementally. When contributing to the front-end, please keep in mind the following ongoing migrations:

### Global

- ☐ TypeScript
  1. All `.js` files using `// @ts-check`
  2. All `.js` files moved to `.ts`
- ☐ Class components → Functional components

### `orchest-webserver`

- ☐ Extract all shared logic/state into `useOrchest()` hook [(See #214 for initial setup)](https://github.com/orchest/orchest/pull/214)
