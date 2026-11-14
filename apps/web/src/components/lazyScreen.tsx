import { useEffect, useState } from "preact/hooks";
import type { ComponentType } from "preact";
import { Splash } from "./ui";

export function lazyScreen<P extends object>(load: () => Promise<ComponentType<P>>) {
  let cached: ComponentType<P> | null = null;

  return function LazyScreen(props: P) {
    const [Screen, setScreen] = useState<ComponentType<P> | null>(cached);

    useEffect(() => {
      if (Screen) return;
      load().then((loaded) => {
        cached = loaded;
        setScreen(() => loaded);
      });
    }, []);

    return Screen ? <Screen {...props} /> : <Splash />;
  };
}
