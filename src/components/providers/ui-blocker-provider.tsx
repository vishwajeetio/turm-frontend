"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState
} from "react";

import { AppLoaderOverlay } from "@/components/app-loader-overlay";

type UiBlockerContextValue = {
  withUiBlock: <T>(message: string, task: () => Promise<T>) => Promise<T>;
};

const UiBlockerContext = createContext<UiBlockerContextValue | null>(null);

export function UiBlockerProvider({ children }: { children: React.ReactNode }) {
  const tokenRef = useRef(0);
  const [blocks, setBlocks] = useState<Array<{ token: number; message: string }>>([]);

  const beginBlock = useCallback((message: string) => {
    const token = tokenRef.current + 1;
    tokenRef.current = token;
    setBlocks((current) => [...current, { token, message }]);
    return () => {
      setBlocks((current) => current.filter((item) => item.token !== token));
    };
  }, []);

  const withUiBlock = useCallback(
    async <T,>(message: string, task: () => Promise<T>) => {
      const release = beginBlock(message);
      try {
        return await task();
      } finally {
        release();
      }
    },
    [beginBlock]
  );

  const value = useMemo(
    () => ({
      withUiBlock
    }),
    [withUiBlock]
  );

  const activeMessage = blocks[blocks.length - 1]?.message;

  return (
    <UiBlockerContext.Provider value={value}>
      {children}
      {activeMessage ? <AppLoaderOverlay message={activeMessage} /> : null}
    </UiBlockerContext.Provider>
  );
}

export function useUiBlocker() {
  const context = useContext(UiBlockerContext);
  if (!context) {
    throw new Error("useUiBlocker must be used within UiBlockerProvider");
  }
  return context;
}
