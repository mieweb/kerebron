export function debounce(cb: any, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: any) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => cb(...args), wait);
  };
}

export function debounceWithCancel(cb: any, wait: number) {
  let timeout: ReturnType<typeof setTimeout>;

  const start = (...args: any) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => cb(...args), wait);
  };

  const cancel = () => {
    clearTimeout(timeout);
  };

  return {
    start,
    cancel,
  };
}
