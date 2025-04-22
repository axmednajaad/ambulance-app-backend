// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const tryCatch = (fn: Function) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);
