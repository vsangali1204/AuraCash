import { ApolloClient, InMemoryCache, createHttpLink, from } from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { fromPromise } from "@apollo/client/link/utils";
import { useAuthStore } from "@/store/authStore";

const API_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/graphql/`
  : "/graphql/";

const httpLink = createHttpLink({ uri: API_URL });

const authLink = setContext((_, { headers }) => {
  const token = useAuthStore.getState().accessToken;
  return {
    headers: {
      ...headers,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  };
});

let isRefreshing = false;
let pendingRequests: Array<() => void> = [];

function resolvePending() {
  pendingRequests.forEach((cb) => cb());
  pendingRequests = [];
}

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken, setTokens, logout } = useAuthStore.getState();
  if (!refreshToken) {
    logout();
    return false;
  }
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `mutation RefreshToken($refreshToken: String!) {
          refreshToken(refreshToken: $refreshToken) {
            accessToken
            refreshToken
          }
        }`,
        variables: { refreshToken },
      }),
    });
    const json = await res.json();
    const data = json?.data?.refreshToken;
    if (data?.accessToken) {
      setTokens(data.accessToken, data.refreshToken);
      return true;
    }
  } catch {
    // network error
  }
  logout();
  return false;
}

const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    for (const { message } of graphQLErrors) {
      if (message === "Autenticação necessária.") {
        if (isRefreshing) {
          return fromPromise(
            new Promise<void>((resolve) => pendingRequests.push(resolve))
          ).flatMap(() => forward(operation));
        }

        isRefreshing = true;
        return fromPromise(
          refreshAccessToken().then((ok) => {
            isRefreshing = false;
            if (ok) resolvePending();
            return ok;
          })
        )
          .filter(Boolean)
          .flatMap(() => forward(operation));
      }
    }
  }
  if (networkError) {
    console.error("Network error:", networkError);
  }
});

export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: "cache-and-network" },
  },
});
