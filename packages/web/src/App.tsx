import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";

import { HELLO_WORLD } from "@pt/shared";

import "./App.css";
import heroImg from "./assets/hero.png";
import reactLogo from "./assets/react.svg";
import viteLogo from "./assets/vite.svg";
import { useTRPC } from "./trpc.ts";

function App() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: count } = useSuspenseQuery(trpc.counter.count.queryOptions());

  const setCount = useMutation(
    trpc.counter.setCount.mutationOptions({
      onSuccess: (newCount) => {
        queryClient.setQueryData(trpc.counter.count.queryKey(), newCount);
      },
    }),
  );

  const optimisticSetCount = useMutation(
    trpc.counter.setCount.mutationOptions({
      onMutate: async (newCount) => {
        await queryClient.cancelQueries(trpc.counter.count.queryFilter());
        const previous = queryClient.getQueryData(
          trpc.counter.count.queryKey(),
        );
        queryClient.setQueryData(trpc.counter.count.queryKey(), newCount);
        return { previous };
      },
      onSuccess: (newCount) => {
        queryClient.setQueryData(trpc.counter.count.queryKey(), newCount);
      },
      onError: (_err, _newCount, context) => {
        queryClient.setQueryData(
          trpc.counter.count.queryKey(),
          context?.previous,
        );
      },
    }),
  );

  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>Message from shared: {HELLO_WORLD}</p>
        </div>
        <button className="counter" onClick={() => setCount.mutate(count + 1)}>
          Count = {count}
        </button>
        <button
          className="counter"
          onClick={() => optimisticSetCount.mutate(count + 1)}
        >
          Optimistic count = {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  );
}

export default App;
