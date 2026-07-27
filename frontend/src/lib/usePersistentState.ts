import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

function readStoredValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function usePersistentState<T>(
  key: string,
  initialValue: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const initialValueRef = useRef(initialValue);
  initialValueRef.current = initialValue;
  const resolveInitialValue = () =>
    typeof initialValueRef.current === "function"
      ? (initialValueRef.current as () => T)()
      : initialValueRef.current;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    value: T;
  }>(() => ({
    key,
    value: readStoredValue(key, resolveInitialValue()),
  }));
  const value =
    snapshot.key === key
      ? snapshot.value
      : readStoredValue(key, resolveInitialValue());

  useEffect(() => {
    if (snapshot.key === key) return;
    setSnapshot({
      key,
      value: readStoredValue(key, resolveInitialValue()),
    });
  }, [key, snapshot.key]);

  useEffect(() => {
    if (snapshot.key !== key) return;

    try {
      window.localStorage.setItem(key, JSON.stringify(snapshot.value));
    } catch {}
  }, [key, snapshot]);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (nextValue) => {
      setSnapshot((current) => {
        const currentValue =
          current.key === key
            ? current.value
            : readStoredValue(key, resolveInitialValue());
        return {
          key,
          value:
            typeof nextValue === "function"
              ? (nextValue as (previous: T) => T)(currentValue)
              : nextValue,
        };
      });
    },
    [key],
  );

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== key) {
        return;
      }

      setSnapshot({
        key,
        value: readStoredValue(key, resolveInitialValue()),
      });
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [key]);

  return [value, setValue];
}
